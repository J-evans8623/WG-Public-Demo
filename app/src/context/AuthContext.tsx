import React, { createContext, useState, useEffect } from 'react';
import { openAuthPopup } from './authUtils';

interface User {
  email: string;
  accountType: 'free' | 'premium';
}

interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  skipAuth: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isGuest: false,
  user: null,
  signIn: async () => {},
  signOut: async () => {},
  skipAuth: () => {},
});

export const AuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setUser({ email: data.session.email, accountType: data.session.accountType });
          } else {
            console.log('No active session found.');
          }
        } else {
          console.error('Failed to fetch session:', response.status);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
  
    fetchSession();
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'AUTH_SUCCESS') {
        await fetchSession(); // Refresh session data after successful auth
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  
  }, []);
  
  

  const signIn = async () => {
    try {
      const popup = openAuthPopup();
      if (!popup) {
        throw new Error('Popup blocked. Please enable popups for this site.');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const skipAuth = () => {
    setIsGuest(true);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, isGuest, user, signIn, signOut, skipAuth }}>
      {children}
    </AuthContext.Provider>
  );
};