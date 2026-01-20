/**
 * @file registerFlyerModal.tsx
 * @description
 * Side-effect bridge that registers the FlyerModal with the central ModalRegistry.
 * This enables the 'flyerCampaignModal' to be triggered globally via the 
 * GlobalModalProvider without explicitly importing the modal component into 
 * the central switch-statement in AppModals.tsx.
 */

import React from 'react';
import { registerModal } from '@/app/workspace/(studygraph)/components/modals/ModalRegistry';
import { FlyerModal } from './FlyerModal';

/**
 * Step 1: Register the modal factory.
 * The factory receives props from the modal host and returns the FlyerModal element.
 * We map it to the string key 'flyerCampaignModal' for O(1) retrieval.
 */
registerModal('flyerCampaignModal', (props) => {
  return (
    <FlyerModal 
      onClose={props.onClose}
      status={props.status}
      email={props.email}
    />
  );
});

console.log('[registerFlyerModal] Campaign modal registered with system.');