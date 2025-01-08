/**
 * File: /server/auth/oauth.ts
 * Responsibility: Manage OAuth 2.0 Authorization Code flow with PKCE.
 * Dependencies:
 *   - /server/auth/types.ts for AuthConfig and SessionData.
 *   - /server/auth/session.ts for session management.
 *   - google-auth-library for OAuth2Client.
 */

import { AuthConfig, SessionData } from './types';
import { RedisSessionManager } from './session';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import crypto from 'crypto';
import { FirestoreFirebaseService } from '../services/firebase';


const sessionManager = new RedisSessionManager();
const firebaseService = new FirestoreFirebaseService();

/**
 * OAuthManager interface defines methods for OAuth 2.0 flows.
 */
export interface OAuthManager {
  initiateAuth(): Promise<string>;
  handleCallback(code: string): Promise<SessionData>;
  refreshAccessToken(refreshToken: string): Promise<SessionData>;
}

export class GoogleOAuthManager implements OAuthManager {
  private config: AuthConfig;
  private oauth2Client: OAuth2Client;
  private codeVerifier: string;

  constructor(config: AuthConfig) {
    this.config = config;
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    this.codeVerifier = '';
  }

  /**
   * Generates a PKCE challenge and returns the authorization URL.
   * @returns Authorization URL.
   */
  async initiateAuth(): Promise<string> {
    // Generate a code verifier and challenge
    this.codeVerifier = crypto.randomBytes(64).toString('hex'); // Store securely
    const codeChallenge = this.base64URLEncode(
      this.sha256(this.codeVerifier)
    );

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256' as CodeChallengeMethod,
    });

    return authUrl;
  }

  /**
   * Exchanges authorization code for tokens and creates a session.
   * @param code - Authorization code from the provider.
   * @returns SessionData with tokens.
   */
  async handleCallback(code: string): Promise<SessionData> {
    const { tokens } = await this.oauth2Client.getToken({
      code,
      codeVerifier: this.codeVerifier,
    });

    // Derive our own user ID (e.g., a hash of the user's email)
    const userInfo = await this.getUserInfo(tokens.access_token!);
    const derivedUserId = crypto
      .createHash('sha256')
      .update(userInfo.email)
      .digest('hex');

    const sessionData: SessionData = {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: tokens.expiry_date!, // Already a timestamp in ms
      userId: derivedUserId,
    };

    const sessionId = crypto.randomUUID();
    await sessionManager.createSession(sessionId, sessionData);
    if (tokens.refresh_token) {
        await firebaseService.storeRefreshToken(derivedUserId, tokens.refresh_token);
      } else {
        console.warn(`No refresh token returned for user: ${derivedUserId}`);
      }

    return sessionData;
  }

  /**
   * Refreshes access token using a refresh token.
   * @param refreshToken - Refresh token from session data.
   * @returns Updated session data with new tokens.
   */
  async refreshAccessToken(refreshToken: string): Promise<SessionData> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    // Assuming userId remains the same, retrieve it from session or maintain it elsewhere
    const userId = ''; // Retrieve or maintain the userId as per your application's logic

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || refreshToken, // Fallback to existing refresh token
      expiresAt: credentials.expiry_date!,
      userId: userId,
    };
  }

  /**
   * Retrieves user information from Google.
   * @param accessToken - The access token used to fetch user info.
   * @returns User information such as email.
   */
  private async getUserInfo(accessToken: string): Promise<{ email: string }> {
    const response = await this.oauth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data as { email: string };
  }

  /**
   * Helper function to perform SHA256 hashing.
   * @param buffer - The buffer to hash.
   * @returns The hashed buffer.
   */
  private sha256(buffer: Buffer | string) {
    return crypto.createHash('sha256').update(buffer).digest();
  }

  /**
   * Helper function to base64URL-encode a buffer.
   * @param buffer - The buffer to encode.
   * @returns The base64URL-encoded string.
   */
  private base64URLEncode(buffer: Buffer) {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
