// context/AuthContext.tsx
import React, { createContext, useState, useEffect } from 'react';

interface User {
  email: string;
  accountType: 'free' | 'premium';
  accessToken: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  signIn: (token: string) => void;
  signOut: () => void;
  skipAuth: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isGuest: false,
  user: null,
  signIn: () => {},
  signOut: () => {},
  skipAuth: () => {},
});


export const AuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const guest = localStorage.getItem('isGuest') === 'true';
    if (token) {
      // Optionally verify token with backend
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUser({ accessToken: token, email: decoded.email, accountType: decoded.accountType });
    }
    if (guest) {
      setIsGuest(true);
    }
  }, []);

  const signIn = (token: string) => {
    localStorage.setItem('token', token);
    // Decode token to extract user info
    const decoded = JSON.parse(atob(token.split('.')[1]));
    setUser({ accessToken: token, email: decoded.email, accountType: decoded.accountType });
    setIsGuest(false);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsGuest(false);
  };

  const skipAuth = () => {
    localStorage.setItem('isGuest', 'true');
    setIsGuest(true);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, isGuest, user, signIn, signOut, skipAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
