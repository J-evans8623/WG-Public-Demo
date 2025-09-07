/***************************************************************************************
 * @file NavigationController.tsx
 * @description
 *   A smart controller component that dynamically selects between read-only and read/write
 *   navigation panels based on the current document's access control permissions. This
 *   component integrates with the DocumentAccessManager to determine the appropriate
 *   navigation experience for each user's access level. When users have edit permissions,
 *   the full NavigationPanel with creation, editing, and deletion capabilities is rendered.
 *   When users have read-only access, the ReadOnlyNavigationPanel is shown instead,
 *   providing the same visual structure but preventing modification operations. The
 *   controller seamlessly handles the transition between access modes while maintaining
 *   consistent state management and user experience. This approach centralizes access
 *   control logic and ensures that navigation capabilities automatically align with
 *   document permissions without requiring manual coordination across components.
 *
 * Responsibilities:
 *   - Determine current document access permissions using DocumentAccessManager
 *   - Dynamically select appropriate navigation component (read-only vs read/write)
 *   - Forward all props to the selected navigation component
 *   - Provide centralized access control logic for navigation functionality
 *   - Maintain consistent interface regardless of underlying component selection
 *   - Handle access state transitions smoothly without UI disruption
 *
 * @author System
 * @date Current
 ***************************************************************************************/

import React from 'react';
import NavigationPanel from './components/layout/Sidebar/NavigationPanel';
import ReadOnlyNavigationPanel from './components/layout/ReadOnly/navigation/ReadOnlyNavigationPanel';
import DocumentAccessManager from './components/hooks/access/DocumentAccessManager';

/**
 * The top-level view types that can be displayed.
 */
type TopLevelView = 'home' | 'map' | 'user';

/**
 * @interface NavigationControllerProps
 * @description Props for the NavigationController component that will be forwarded
 *              to whichever navigation panel component is selected based on access control.
 * @property {boolean} [isManuallyOpen] - If true, the panel is forced open by manual toggle.
 * @property {TopLevelView} currentView - The currently active top-level view.
 * @property {(view: TopLevelView) => void} onSetView - Callback to set the top-level view.
 * @property {(expanded: boolean) => void} [onExpandedChange] - Optional callback to inform
 *           parent components of the panel's expanded/collapsed state.
 */
interface NavigationControllerProps {
  isManuallyOpen?: boolean;
  currentView: TopLevelView;
  onSetView: (view: TopLevelView) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * @function NavigationController
 * @description
 *   The main controller component that analyzes current document access permissions
 *   and renders the appropriate navigation panel component. This function serves as
 *   the single point of integration for access-controlled navigation, eliminating
 *   the need for access control logic in parent components.
 *
 * Steps:
 *   1. Retrieve DocumentAccessManager singleton instance
 *   2. Get current document ID and access permissions
 *   3. Determine if user can edit the current document
 *   4. Select and render appropriate navigation component
 *   5. Forward all props to selected component unchanged
 *   6. Provide debug logging for access control decisions
 */
const NavigationController: React.FC<NavigationControllerProps> = (props) => {
  console.log('NavigationController.tsx 3001 › Controller rendering with props', {
    currentView: props.currentView,
    isManuallyOpen: props.isManuallyOpen
  });

  // Step 1: Get DocumentAccessManager singleton instance
  const manager = DocumentAccessManager.getInstance();
  
  // Step 2: Retrieve current document context
  const currentDocId = manager.getCurrentDocId();
  const status = manager.getStatus();
  
  console.log('NavigationController.tsx 3002 › Access context retrieved', {
    currentDocId,
    status
  });

  // Step 3: Determine edit capability for access control decision
  let canEdit = false;
  if (currentDocId) {
    canEdit = manager.canEdit(currentDocId);
    console.log('NavigationController.tsx 3003 › Access permissions determined', {
      docId: currentDocId,
      canEdit,
      hasRecord: manager.hasRecord(currentDocId)
    });
  } else {
    console.log('NavigationController.tsx 3004 › No current document, defaulting to read-only');
  }

  // Step 4: Select appropriate navigation component based on access control
  if (canEdit) {
    console.log('NavigationController.tsx 3005 › Rendering read/write NavigationPanel');
    return <NavigationPanel {...props} />;
  } else {
    console.log('NavigationController.tsx 3006 › Rendering read-only NavigationPanel');
    return <ReadOnlyNavigationPanel {...props} />;
  }
};

export default NavigationController;