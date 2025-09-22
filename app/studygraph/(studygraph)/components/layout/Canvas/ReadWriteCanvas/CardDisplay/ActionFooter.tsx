// bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/ActionFooter.tsx

/**
 * @file ActionFooter.tsx  // update - 1
 * @description  // update - 2
 * The ActionFooter component serves as the contextual, sticky control bar positioned at the bottom of the  // update - 3
 * CardDisplay container for the read/write experience. This file realigns the unified footer back to the    // update - 4
 * original, proven UX and DOM structure used by the legacy implementations. Specifically, the UI is driven   // update - 5
 * entirely by the current UI mode (`editing`) rather than a capability flag. In read mode, the footer shows  // update - 6
 * a left-aligned AddResourceDropdown (portal-based) that hosts the Ask AI button and Add Card trigger. In     // update - 7
 * edit mode, the footer hides Ask/Add and instead renders Save and Cancel actions right-aligned, using the    // update - 8
 * UI Button component and honoring validation via the `isSaveDisabled` prop. The component preserves the      // update - 9
 * absolute positioning, fixed height (56px), and legacy class hooks (`action-footer`, `footer-transition`) to // update - 10
 * avoid visual regressions with existing CSS. Concise console logs (file-scoped with unique 4-digit codes)    // update - 11
 * are emitted at key interaction points (render, save, cancel, add-select) to aid triage without noise. All   // update - 12
 * handlers execute in O(1); dropdown item rendering is O(N) with a very small, constant-bounded list.        // update - 13
 */

import React from 'react';  // update - 14
import AddResourceDropdown from '../../../CardDisplay/v2/AddResourceDropdown';
import type { ResourceType as CardResourceType } from '../../../CardDisplay/v2/AddResourceDropdown';  // update - 16
import { Button } from '@/components/ui/button';  // update - 17

export interface ActionFooterProps {  // update - 18
  editing: boolean;  // update - 19
  onAddResource: (type: CardResourceType) => void;  // update - 20
  onSave: () => void;  // update - 21
  onCancel: () => void;  // update - 22
  isSaveDisabled?: boolean;  // update - 23
  askHandler: () => void;  // update - 24
  canEdit: boolean; 
}

/**
 * @function ActionFooter  // update - 25
 * @description  // update - 26
 * Render the bottom control bar for the read/write CardDisplay. The UI is strictly keyed off the current     // update - 27
 * editing state: when `editing` is false (read mode), show the AddResourceDropdown (Ask AI + Add Card menu);  // update - 28
 * when `editing` is true (edit mode), replace the left cluster with right-aligned Save/Cancel controls and    // update - 29
 * hide Ask/Add to prevent conflicting actions during edits. Save honors `isSaveDisabled` so external form     // update - 30
 * validity can be enforced. Logs are purposefully placed to indicate render state, resource selection, and    // update - 31
 * save/cancel intent. All event handlers are O(1) and keep DOM/class hooks unchanged to protect CSS parity.   // update - 32
 */
const ActionFooter: React.FC<ActionFooterProps> = ({  // update - 33
  editing,  // update - 34
  onAddResource,  // update - 35
  onSave,  // update - 36
  onCancel,  // update - 37
  isSaveDisabled = false,  // update - 38
  askHandler,  // update - 39
  canEdit,
}) => {
  // Step 1: Log current footer state for debugging  // update - 40
  console.log('[ActionFooter.tsx][8001] render footer', { editing, isSaveDisabled });  // update - 41

  // Step 2: Handle save with validation and logging  // update - 42
  const handleSaveClick = () => {  // update - 43
    console.log('[ActionFooter.tsx][8002] Save clicked — disabled:', isSaveDisabled);  // update - 44
    if (!isSaveDisabled) onSave();  // update - 45
  };

  // Step 3: Handle cancel with logging  // update - 46
  const handleCancelClick = () => {  // update - 47
    console.log('[ActionFooter.tsx][8003] Cancel clicked');  // update - 48
    onCancel();  // update - 49
  };

  // Step 4: Handle Add selection with logging  // update - 50
  const handleResourceSelect = (type: CardResourceType) => {  // update - 51
    console.log('[ActionFooter.tsx][8004] add resource selected', { type });  // update - 52
    onAddResource(type);  // update - 53
  };

  // Step 5: Render — preserve legacy hooks, absolute positioning, and fixed height  // update - 54
  return (  // update - 55
    <footer  // update - 56
      className="action-footer footer-transition"  // update - 57
      style={{  // update - 58
        position: 'absolute',  // update - 59
        left: 0,  // update - 60
        right: 0,  // update - 61
        bottom: 0,  // update - 62
        height: '56px',  // update - 63
        display: 'flex',  // update - 64
        alignItems: 'center',  // update - 65
        justifyContent: editing ? 'flex-end' : 'flex-start',  // update - 66
        padding: '0.5rem 1rem',  // update - 67
        background: 'var(--header-tint, var(--surface))',  // update - 68
        borderTop: '1px solid var(--edge)',  // update - 69
        zIndex: 30,  // update - 70
        overflow: 'hidden',  // update - 71
      }}
    >
      {editing ? (  // update - 72
        // Step 6: Edit mode — Save/Cancel on the right  // update - 73
        <div  // update - 74
          className="edit-actions-container"  // update - 75
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', height: '100%' }}  // update - 76
        >
          <Button  // update - 77
            variant="ghost"  // update - 78
            size="sm"  // update - 79
            onClick={handleCancelClick}  // update - 80
            style={{ height: '32px', minWidth: '80px' }}  // update - 81
          >
            Cancel 
          </Button>

          <Button  // update - 83
            size="sm"  // update - 84
            onClick={handleSaveClick}  // update - 85
            disabled={isSaveDisabled}  // update - 86
            style={{  // update - 87
              height: '32px',  // update - 88
              minWidth: '80px',  // update - 89
              opacity: isSaveDisabled ? 0.5 : 1,  // update - 90
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',  // update - 91
            }}
            title={isSaveDisabled ? 'Please fill in all required fields' : 'Save changes'}  // update - 92
          >
            Save  
          </Button>
        </div>
      ) : (
        // Step 7: Read mode — AddResourceDropdown (Ask AI + Add Card) left-aligned  
        <div 
          className="add-resource-container"  
          style={{ display: 'flex', alignItems: 'center', height: '100%' }} 
        >
          <AddResourceDropdown  
            disabled={false}  
            onSelectType={handleResourceSelect}  
            askHandler={askHandler}  
            canAdd={canEdit}
          />
        </div>
      )}
    </footer>
  );
};

export default ActionFooter;  // update - 102
