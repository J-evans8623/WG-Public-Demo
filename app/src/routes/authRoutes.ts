/**
 * authRoutes.ts
 * 
 * Provides authentication-related API routes using Express Router.
 * Responsibilities:
 * - Defines routes for user authentication via Google OAuth2.
 * - Implements a silent callback endpoint (`/oauth/callback`) for OAuth2 token exchanges.
 * - Provides a login route for direct user authentication.
 * - Communicates tokens securely to the parent app using `postMessage`.
 * Dependencies:
 * - Express for routing.
 * - AuthService for handling token exchanges and Google OAuth2 logic.
 * - AuthController for handling authentication requests.
 * - RateLimiter to prevent API abuse.
 */

import express from 'express';
import AuthService from '../services/authService';
import AuthController from '../controllers/authController';
import RateLimiter from '../middleware/rateLimiter';

const router = express.Router();

/**
 * POST /api/login
 * 
 * Authenticates a user using a Google OAuth token and returns a JWT.
 * Rate-limited to prevent abuse.
 */
router.post('/login', RateLimiter, AuthController.login);

/**
 * GET /oauth/callback
 * 
 * Silent OAuth2 callback endpoint.
 * Handles the token exchange after Google redirects the user here and uses `postMessage`
 * to securely send tokens and state back to the parent application.
 * 
 * Query Parameters:
 * - code: Authorization code from Google.
 * - state: Encoded user intent (e.g., `file-sharing`, `premium-service`).
 * 
 * Responses:
 * - Sends an HTML script to post the tokens and state back to the parent window and closes the popup.
 */
router.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  try {
    if (!code) {
      throw new Error('Authorization code is missing.');
    }

    // Exchange the authorization code for tokens
    const tokens = await AuthService.getTokensFromCode(code as string);

    // Generate the HTML response to send tokens and state back to the parent app
    const responseHtml = `
      <script>
        // Post tokens and state back to the parent window
        window.opener.postMessage(
          ${JSON.stringify({ tokens, state })},
          window.opener.location.origin
        );
        // Close the popup
        window.close();
      </script>
    `;
    res.send(responseHtml);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('OAuth2 callback error:', errorMessage);
    res.status(400).send('Authentication failed.');
  }
});

export default router;
