import crypto from 'crypto';

export interface OAuthSession {
  state: string;
  createdAt: number;
}

class SessionStore {
  private sessions: Map<string, OAuthSession>;
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.sessions = new Map();
    // Run cleanup every minute
    setInterval(() => this.clearExpiredSessions(), 60 * 1000);
  }

  createSession(): string {
    // Generate a cryptographically secure random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Create new session
    this.sessions.set(sessionId, {
      state: crypto.randomBytes(16).toString('hex'), // Additional state for verification
      createdAt: Date.now()
    });

    return sessionId;
  }

  getSession(sessionId: string): OAuthSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.createdAt > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private clearExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export default new SessionStore();