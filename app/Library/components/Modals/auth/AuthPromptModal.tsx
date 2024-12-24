import React from 'react';
import { AuthPromptModalProps } from './AuthPromptModal.types';
import { GoogleLogin } from '@react-oauth/google';

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, onSignInSuccess, onSignInFailure, onSkip }) => {
  if (!isOpen) return null;

  return (
    <div className="auth-prompt-overlay fixed inset-0 bg-[#FCFDFD] bg-opacity-90
 flex items-center justify-center z-50">
      <div className="auth-prompt-modal bg-white rounded-lg p-6 shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Welcome to Bloom Maps</h2>
        <p className="mb-6">Sign in to enable autosave and file sharing with Google Drive or continue as a guest.</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
          >
            Continue as Guest
          </button>
          <GoogleLogin
            onSuccess={onSignInSuccess}
            onError={onSignInFailure}
            theme="outline"
            size="large"
          />
        </div>
      </div>
    </div>
  );
};

export default AuthPromptModal;
