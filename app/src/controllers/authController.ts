/**
 * authController.ts
 * 
 * Handles API requests related to authentication, such as user login.
 */

import { Request, Response } from 'express';
import AuthService from '../services/authService';

/**
 * AuthController
 * 
 * Contains methods to handle authentication-related HTTP requests.
 */
class AuthController {
  /**
   * Handles user login via Google OAuth token.
   * 
   * @param req - Express Request object containing the Google OAuth token.
   * @param res - Express Response object to send back the JWT and user details.
   */
  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ status: 'error', message: 'Token is required.' });
        return;
      }

      // Validate the Google OAuth token
      const googleUserData = await AuthService.validateToken(token);
      if (!googleUserData) {
        res.status(401).json({ status: 'error', message: 'Invalid token.' });
        return;
      }

      // Retrieve or create the user
      const user = await AuthService.retrieveUser(googleUserData);

      // Generate JWT
      const jwtToken = AuthService.generateJWT(user);

      res.status(200).json({
        status: 'success',
        token: jwtToken,
        user: {
          email: user.email,
          accountType: user.accountType,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
  }
}

export default new AuthController();
