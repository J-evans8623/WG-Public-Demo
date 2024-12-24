/**
 * authService.ts
 * 
 * Provides a comprehensive OAuth2 flow and token management for Google authentication and API access.
 * Responsibilities:
 * - Handles user authentication using Google OAuth2.
 * - Supports two modes of user interaction:
 *   1. Initial sign-in on navigation (direct redirection).
 *   2. Mid-session authentication using a popup or new tab (to preserve user work).
 * - Manages token exchange and ensures secure token handling.
 * - Supports flexible redirect handling based on the action type (`file-sharing`, `premium-service`, etc.).
 * - Enables integration with Google Drive and premium features based on user account type.
 * 
 * Notes:
 * - For mid-session sign-ins, OAuth redirection occurs in a new browser tab or popup.
 * - Uses the `state` parameter to identify the user's intent and handle appropriate post-authentication actions.
 * - Prevents user work loss by avoiding full-page reloads or interruptions.
 * 
 * Dependencies:
 * - google-auth-library for OAuth2 handling.
 * - Mongoose for user persistence.
 * - JwtUtils for session JWT generation.
 */
/**
 * authService.ts
 * 
 * Provides a complete OAuth2 flow for Google authentication and API access.
 * Responsibilities:
 * - Handles Google OAuth2 authentication for login and API actions.
 * - Manages tokens (access and refresh) for extended user sessions.
 * - Generates signed JWTs for application-level authentication.
 * Dependencies:
 * - google-auth-library for OAuth2 flow.
 * - Mongoose for user persistence.
 * - JwtUtils for token generation.
 */
import { OAuth2Client } from 'google-auth-library';
import UserModel, { IUser } from '../models/userModel';
import JwtUtils from '../utils/jwtUtils';

class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.REDIRECT_URL // Ensure these are set in the environment variables
    );
  }

  /**
   * Generates the authorization URL for Google OAuth2.
   * Includes the `state` parameter to track the user's intent (e.g., `file-sharing`, `premium-service`).
   * @param actionType - The user's intended action after authentication.
   * @returns The Google OAuth2 authorization URL.
   */
  generateAuthUrl(actionType: string): string {
    return this.googleClient.generateAuthUrl({
      access_type: 'offline', // Required for refresh tokens
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file', // Access to user's Google Drive
      ],
      prompt: 'consent', // Ensures refresh tokens are provided
      state: actionType, // Encodes the user's intent
    });
  }

  /**
   * Exchanges the authorization code for access and refresh tokens.
   * @param code - The authorization code from the user's consent.
   * @returns The tokens (access and refresh) provided by Google.
   */
  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.googleClient.getToken(code);
    this.googleClient.setCredentials(tokens);
    return tokens;
  }

  /**
   * Processes the `state` parameter to determine the post-authentication action.
   * @param state - The user's intended action (`file-sharing`, `premium-service`, etc.).
   * @param tokens - Tokens provided by Google after authentication.
   */
  async handlePostAuthAction(state: string, tokens: any): Promise<void> {
    // Save tokens securely or pass to the appropriate service
    if (state === 'file-sharing') {
      // Example: initiate a file-sharing action
      console.log('Initiate file-sharing with tokens:', tokens);
    } else if (state === 'premium-service') {
      // Example: enable premium features
      console.log('Enable premium services with tokens:', tokens);
    }
  }

  /**
   * Validates an existing Google OAuth token.
   * @param token - The Google OAuth token to validate.
   * @returns Decoded token data if valid.
   */
  async validateToken(token: string): Promise<any> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    } catch (error) {
      throw new Error('Invalid Google OAuth token.');
    }
  }

  /**
   * Retrieves or creates a user in the database based on Google profile data.
   * @param googleUserData - Data from the validated Google token.
   * @returns The user object from the database.
   */
  async retrieveUser(googleUserData: any): Promise<IUser> {
    const { sub: googleId, email } = googleUserData;
    let user = await UserModel.findOne({ googleId });
    if (!user) {
      user = await UserModel.create({ googleId, email });
    }
    return user;
  }

  /**
   * Generates a JWT for application-level authentication.
   * @param user - The authenticated user object.
   * @returns A signed JWT containing user details.
   */
  generateJWT(user: IUser): string {
    return JwtUtils.generateJWT({
      id: user._id,
      email: user.email,
      accountType: user.accountType,
    });
  }
}

export default new AuthService();
