// bloom-maps/Library/hooks/useModalKeyBindings.tsx

import { useEffect } from 'react';

interface KeyBindingsProps {
  onClose: () => void;
  onCreate: () => void;
  moveFocusToContent: () => void;
  moveFocusToTitle: () => void;
}

const useModalKeyBindings = ({ onClose, onCreate, moveFocusToContent, moveFocusToTitle }: KeyBindingsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'Enter':
          if (document.activeElement?.id === 'modal-title') {
            event.preventDefault();
            moveFocusToContent();
          } else if (document.activeElement?.id === 'modal-content') {
            event.preventDefault();
            onCreate();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          const bloomLevel = parseInt(event.key, 10);
          const bloomLevelInput = document.querySelector<HTMLInputElement>(`input[name="bloomLevel"][value="${bloomLevel}"]`);
          if (bloomLevelInput) bloomLevelInput.checked = true;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onCreate, moveFocusToContent, moveFocusToTitle]);
};

export default useModalKeyBindings;
