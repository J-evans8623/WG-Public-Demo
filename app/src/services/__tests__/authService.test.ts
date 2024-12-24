/**
 * authService.ts
 * 
 * Provides business logic for user authentication and token management.
 * Responsibilities:
 * - Validates Google OAuth tokens.
 * - Retrieves or creates users in the database.
 * - Generates signed JWTs for authenticated users.
 * Dependencies:
 * - Mongoose for user retrieval and creation.
 * - JSON Web Token (JWT) for token generation.
 * - Google API client for OAuth token validation.
 */
import UserModel, { IUser } from '../../models/userModel';
import JwtUtils from '../utils/jwtUtils';
import { OAuth2Client } from 'google-auth-library';

class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  /**
   * Validates a Google OAuth token.
   * @param token - The Google OAuth token to validate.
   * @returns Decoded token data if valid; otherwise throws an error.
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
   * Retrieves or creates a user based on Google OAuth data.
   * @param googleUserData - Data retrieved from the validated Google token.
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
   * Generates a JWT for an authenticated user.
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
