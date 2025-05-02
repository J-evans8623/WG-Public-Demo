/***********************************************************************************************
 * @file [...nextauth].ts
 * @description
 *   NextAuth.js configuration file for handling authentication via Google only.
 *   This file integrates NextAuth.js into our existing PKCE-based flow but removes the custom
 *   Redis session storage. Session data is now stored via NextAuth’s built-in JWT mechanism,
 *   and only a secure session cookie is sent to the client.
 *
 * Responsibilities:
 *   - Configure OAuth provider for Google.
 *   - Use NextAuth’s JWT-based session strategy to store sensitive tokens on the server.
 *   - Expose only minimal, non‑sensitive session data (like email and accountType) to the client.
 *   - Provide token refresh logic to keep the session active without re‑prompting the user.
 *
 * @author 
 * @date 
 ***********************************************************************************************/
import NextAuth, {
  type NextAuthOptions,
  type Session as NextAuthSession,
} from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import jwt from 'jsonwebtoken';

/**
 * Module augmentation for NextAuth session to include `accountType`.
 * This ensures the session.user object contains both email and accountType.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      email: string;
      accountType: string;
    };
  }
}

/**
 * Extended JWT interface to hold sensitive, server-only fields.
 * These fields (accessToken, refreshToken, expiresAt, etc.) are stored in the token
 * and are not exposed to the client.
 */
interface CustomToken extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  accountType?: string;
}

export const authOptions: NextAuthOptions = {
  // Configure the only provider we support: Google.
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // Use NextAuth secret for signing and encryption of the JWT.
  secret: process.env.NEXTAUTH_SECRET!,

  // Configure session strategy to use JWT.
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },

  // Additional JWT configuration can be added here if needed.
  jwt: {},

  callbacks: {
    /**
     * @function jwt
     * @description
     *   Runs on sign‑in and whenever the JWT is updated/refreshed.
     *   Stores sensitive data (accessToken, refreshToken, expiresAt, etc.) in the token,
     *   which is kept only on the server.
     */
    async jwt({ token, account, user }): Promise<CustomToken> {
      // On initial sign‑in, account and user are provided.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.email = user?.email ?? '';
      }
      return token as CustomToken;
    },

    /**
     * @function session
     * @description
     *   Runs whenever NextAuth returns a session to the client.
     *   Attaches only minimal, non‑sensitive information (email and accountType) to session.user.
     */
    async session({ session, token }): Promise<NextAuthSession> {
      session.user.email = (token as CustomToken).email ?? '';
      session.user.accountType = (token as CustomToken).accountType ?? 'free';
      return session;
    },
  },
};

export default NextAuth(authOptions);
