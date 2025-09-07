/**
 * @file GenerateLessonModal.tsx (Updated)
 * @description
 * Updated lesson generation modal that now imports from the centralized modals
 * system while maintaining backward compatibility. This component serves as a
 * bridge between the existing modal usage patterns and the new centralized
 * modal system. The implementation preserves all existing functionality while
 * leveraging the enhanced modal with visibility controls and consistent styling.
 * This approach ensures that existing code continues to work without modification
 * while new implementations can use the centralized system directly.
 *
 * Responsibilities:
 *   - Maintain backward compatibility with existing modal usage
 *   - Delegate functionality to the enhanced centralized modal
 *   - Preserve existing prop interfaces and behavior expectations
 *   - Provide seamless transition to new modal system
 *
 * @author System
 * @date Current
 */

import React from 'react';
import { EnhancedLessonGenerationModal } from '../../modals/AppModals';

interface GenerateLessonModalProps {
  onClose: () => void;
  onSuccess: (responseData: any) => void;
  docFileId: string;
}

/**
 * @function GenerateLessonModal
 * @description
 * Backward compatibility wrapper for the enhanced lesson generation modal.
 * This component maintains the existing interface while delegating to the
 * new centralized modal system, ensuring seamless migration and consistent
 * behavior across the application.
 */
const GenerateLessonModal: React.FC<GenerateLessonModalProps> = (props) => {
  console.log('[GenerateLessonModal.tsx][6001] Legacy modal wrapper invoked, delegating to enhanced modal');
  
  return <EnhancedLessonGenerationModal {...props} />;
};

export default GenerateLessonModal;