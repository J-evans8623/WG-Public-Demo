// UserInfoPanel.tsx

// Depreciate this.... or update it
import React, { useContext } from 'react';
import { useApiContext } from '@/app/src/context/ApiContext';

interface UserInfoPanelProps {
  onClose: () => void;
}

export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({ onClose }) => {
  const { isAuthenticated, user, signIn, signOut } = useApiContext();

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose(); // Optionally, return to another view (e.g., map) after signing out
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">User Information</h2>
      {isAuthenticated ? (
        <div>
          <p className="mb-4">Signed in as: <strong>{user?.email}</strong></p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4">You are not signed in.</p>
          <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Sign In
          </button>
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-6 text-gray-600 underline hover:text-gray-800 transition"
      >
        Back
      </button>
    </div>
  );
};
