// bloom-maps/app/src/auth/singletons.ts
import { GoogleOAuthManager } from '@/app/src/auth/oauth';
import { RedisSessionManager } from '@/app/src/auth/session';
import { AuthConfig } from '@/app/src/auth/types';

const authConfig: AuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

// Instantiate once per process
const oauthManager = new GoogleOAuthManager(authConfig);
const sessionManager = new RedisSessionManager(oauthManager);

export { oauthManager, sessionManager };
