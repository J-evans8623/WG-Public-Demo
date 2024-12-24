// components/Auth/AuthPromptModal.types.ts
export interface AuthPromptModalProps {
    isOpen: boolean;
    onSignInSuccess: (credentialResponse: any) => void;
    onSignInFailure: () => void;
    onSkip: () => void;
  }
  