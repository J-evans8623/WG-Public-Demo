/**
 * File: /server/auth/oauth.ts
 * Responsibility: Manage OAuth 2.0 Authorization Code flow with PKCE.
 * Dependencies:
 *   - /server/auth/types.ts for AuthConfig and SessionData.
 *   - google-auth-library for OAuth2Client.
 *   - /server/utils/redisClient for storing PKCE codeVerifier
 */

import { AuthConfig, SessionData } from './types';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { FirebaseService, FirestoreFirebaseService } from '../services/firebase';
import { redisClient } from '../utils/redisClient'; // <-- Import the Redis client here
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const firebaseService: FirebaseService = new FirestoreFirebaseService();

/**
 * OAuthManager interface defines methods for OAuth 2.0 flows.
 * (Slightly updated to allow an optional `state` parameter for PKCE.)
 */
export interface OAuthManager {
  /**
   * @returns The authorization URL to redirect the user to.
   */
  initiateAuth(): Promise<string>;

  /**
   * @param code  - The authorization code returned by the provider
   * @param state - Optional state parameter used for PKCE retrieval
   * @returns The newly created session data with tokens
   */
  handleCallback(code: string, state?: string): Promise<SessionData>;

  /**
   * @param refreshToken - Refresh token from session data
   * @returns New access token & updated session data
   */
  refreshAccessToken(refreshToken: string): Promise<SessionData>;
}

export class GoogleOAuthManager implements OAuthManager {
  private config: AuthConfig;
  private oauth2Client: OAuth2Client;

  constructor(config: AuthConfig) {
    this.config = config;
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Generates a PKCE codeVerifier, stores it in Redis keyed by a unique state,
   * and returns the authorization URL containing the code_challenge + state.
   */
  async initiateAuth(): Promise<string> {
    try {
      console.log('Starting OAuth authorization...');
      const codeVerifier = crypto.randomBytes(64).toString('hex');
      const codeChallenge = this.base64URLEncode(this.sha256(codeVerifier));
      const state = uuidv4(); // Unique state to tie back to codeVerifier in Redis

      // Store the codeVerifier with an expiration (600 seconds = 10 minutes)
      await redisClient.set(`pkce_${state}`, codeVerifier, { EX: 600 });

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.config.scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256' as CodeChallengeMethod,
        state,
      });
      console.log('Generated auth URL:', authUrl);

      return authUrl;
    } catch (error) {
      console.error('Error initiating OAuth authorization:', error);
      throw error;
    }
  }

  /**
   * Exchanges authorization code for tokens and returns SessionData.
   * The caller (e.g., the API route) can then create a session with sessionManager.
   */
  async handleCallback(code: string, state?: string): Promise<SessionData> {
    console.log('Handling OAuth callback...');
    console.log('Received code:', code);
    console.log('Received state:', state);

    try {
      // Retrieve the codeVerifier from Redis (if state was provided)
      let codeVerifier: string | null = null;
      if (state) {
        codeVerifier = await redisClient.get(`pkce_${state}`);
        if (!codeVerifier) {
          throw new Error('Invalid or expired PKCE state parameter.');
        }
      }

      // Exchange the code for tokens, including the PKCE codeVerifier if found
      const { tokens } = await this.oauth2Client.getToken({
        code,
        codeVerifier: codeVerifier || undefined,
      });

      // Set credentials on the client for subsequent API requests
      this.oauth2Client.setCredentials(tokens);

      // Retrieve user info from Google's UserInfo endpoint
      const userInfo = await this.getUserInfo(tokens.access_token!);
      // Example: derive a stable userId from the user’s email
      const derivedUserId = crypto
        .createHash('sha256')
        .update(userInfo.email)
        .digest('hex');

      // Construct the SessionData object
      const sessionData: SessionData = {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: tokens.expiry_date || Date.now() + 3600_000,
        userId: derivedUserId,
      };

      // If we have a refresh token, optionally store it in Firebase
      if (tokens.refresh_token) {
        await firebaseService.storeRefreshToken(derivedUserId, tokens.refresh_token);
      }

      // Clean up the PKCE codeVerifier from Redis
      if (state) {
        await redisClient.del(`pkce_${state}`);
      }

      // Return session data to the caller,
      // who will handle creating the session in Redis.
      return sessionData;
    } catch (error) {
      console.error('Error handling callback:', error);
      throw error;
    }
  }

  /**
   * Refreshes the access token using the existing refresh token.
   * Returns updated SessionData.
   */
  async refreshAccessToken(refreshToken: string): Promise<SessionData> {
    console.log('Refreshing access token...');
    try {
      // Set the existing refresh token on the OAuth2Client
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      // Request new access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Construct updated session data
      const newSession: SessionData = {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: credentials.expiry_date || Date.now() + 3600_000,
        userId: '', // Caller can re-derive or store userId
      };

      return newSession;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  /**
   * Fetches the user info (e.g., email) from Google.
   */
  private async getUserInfo(accessToken: string): Promise<{ email: string }> {
    try {
      const response = await this.oauth2Client.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data as { email: string };
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }

  /**
   * Helper to generate a SHA256 hash.
   */
  private sha256(buffer: Buffer | string): Buffer {
    return crypto.createHash('sha256').update(buffer).digest();
  }

  /**
   * Helper to convert bytes to Base64URL format.
   */
  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
