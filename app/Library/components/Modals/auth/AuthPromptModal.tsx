import React, { useContext } from 'react';
import { ApiContext} from '../../../../src/context/ApiContext';
import './authModal.css';

const AuthPromptModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { signIn, skipAuth } = useContext(ApiContext);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    try {
      await signIn();
      onClose();
    } catch (error) {
      alert('Failed to sign in.');
    }
  };

  const handleSkip = () => {
    skipAuth();
    onClose();
  };

  return (
    <div className="auth-modal">
      <div className="auth-modal-content">
        <h2>Welcome to Bloom Maps</h2>
        <p>Sign in to enable autosave and file sharing with Google Drive or continue as guest.</p>
        <div className="button-container">
          <button onClick={handleSkip} className="auth-modal-button guest-button">
            Continue as Guest
          </button>
          <button onClick={handleSignIn} className="auth-modal-button google-button">
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C8.36 19.27 5 16.25 5 12C5 7.9 8.2 4.73 12.2 4.73C15.29 4.73 17.1 6.7 17.1 6.7L19 4.72C19 4.72 16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12C2.03 17.05 6.16 22 12.25 22C17.6 22 21.5 18.33 21.5 12.91C21.5 11.76 21.35 11.1 21.35 11.1Z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPromptModal;
