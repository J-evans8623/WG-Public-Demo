/**
 * File: /server/auth/types.ts
 * Responsibility: Define interfaces for session data and authentication configurations.
 * Dependencies: None (purely TypeScript).
 */

export interface SessionData {
  /**
   * Represents the session data for a logged-in user.
   * @property accessToken - The access token for authenticated requests.
   * @property refreshToken - The refresh token used for token renewal.
   * @property expiresAt - Expiration timestamp (Unix).
   * @property userId - Unique identifier for the user.
   */
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
}

export interface AuthConfig {
  /**
   * Configuration for OAuth 2.0 client settings.
   * @property clientId - The client ID from the OAuth provider.
   * @property clientSecret - The client secret for server-side use only.
   * @property redirectUri - URI to redirect after successful authentication.
   * @property scopes - Array of OAuth scopes for permissions.
   */
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}
