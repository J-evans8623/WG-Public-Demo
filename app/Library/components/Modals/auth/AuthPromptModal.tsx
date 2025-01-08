// AuthPromptModal.tsx
import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { AuthPromptModalProps } from './AuthPromptModal.types';


const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, onSignInSuccess, onSignInFailure, onSkip }) => {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      // tokenResponse contains access_token from implicit flow
      onSignInSuccess(tokenResponse);
    },
    onError: () => onSignInFailure?.(),
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata'
    ].join(' '),
    flow: 'implicit'
  });

  if (!isOpen) return null;

  return (
    <div className="auth-prompt-overlay fixed inset-0 bg-[#FCFDFD] bg-opacity-90 flex items-center justify-center z-50">
      <div className="auth-prompt-modal bg-white rounded-lg p-6 shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Welcome to Bloom Maps</h2>
        <p className="mb-6">Sign in to enable autosave and file sharing with Google Drive or continue as guest.</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
          >
            Continue as Guest
          </button>
          <button
            onClick={() => login()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1Z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPromptModal;

