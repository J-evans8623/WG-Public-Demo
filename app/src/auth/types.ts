/**
 * File: /server/auth/types.ts
 * Responsibility: Define interfaces for session data and authentication configurations.
 * Dependencies: None (purely TypeScript).
 */

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email?: string;         // new
  accountType?: 'free' | 'premium'; // new
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
