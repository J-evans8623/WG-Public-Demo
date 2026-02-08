/**
 * @file freemiumContextUiTriggers.tsx
 * @description
 * This component serves as a specialized UI controller for freemium-related interactions within the 
 * learning workspace. Following the Single Responsibility Principle, it encapsulates all logic for 
 * determining user subscription status and rendering the appropriate upgrade triggers and credit 
 * displays. To fix the styling regression, this version removes ad-hoc shadows and restores 
 * original color tokens (like bg-gray-50 for credits) used in the legacy CanvasHeader. It also 
 * introduces a horizontal container bar with a #FFFFFF background as requested. By isolating 
 * these elements, we prevent bloat in the main CanvasHeader and allow the freemium UI to be 
 * positioned flexibly across different viewports (such as floating over the map renderer). 
 * The component utilizes the useAccountStatus hook to monitor subscription states and 
 * demo credit balances in real-time, ensuring that the UI remains reactive to backend changes.
 *
 * Responsibilities:
 * 1) Encapsulate subscription state logic (isSubscribed, isFreemium) to reduce component surface area.
 * 2) Render the "Upgrade" CTA button strictly for non-active or freemium users.
 * 3) Render the "Demo credits" badge to inform freemium users of their remaining capacity.
 * 4) Provide a stable, #FFFFFF horizontal bar container for integration within the Canvas viewport.
 */

import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useAccountStatus } from '@/app/src/context/ApiContext';

export interface FreemiumContextUiTriggersProps {
  /** * Callback function triggered when the user clicks the Upgrade button.
   * This maintains the existing external contract for billing redirects. 
   */
  onUpgrade?: () => void;
}

/**
 * @function FreemiumContextUiTriggers
 * @description
 * This functional component acts as a bridge between the account's subscription data and the 
 * visual triggers displayed on the map. It calculates visibility flags for the 'Upgrade' 
 * button and the 'Demo Credits' badge based on the effective tier and subscription phase. 
 * By using useMemo, we ensure that the visibility logic is only recalculated when the 
 * subscription metadata changes. To ensure visual parity with the original header, 
 * this implementation uses the exact class strings and background tokens from the 
 * legacy code, now wrapped in a pure white horizontal bar.
 */
const FreemiumContextUiTriggers: React.FC<FreemiumContextUiTriggersProps> = ({ onUpgrade }) => {
  // 1. Step 1: Consume account status from the global API context
  const { subscriptionUi, remainingDemoCredits } = useAccountStatus();

  // 2. Step 2: Determine if the user is a freemium user for credit display
  const isFreemium = subscriptionUi?.effectiveTier === 'freemium';

  // 3. Step 3: Compute subscription status to determine if the Upgrade button should be visible
  const isSubscribed = useMemo(() => {
    return subscriptionUi?.phase === 'ACTIVE' || subscriptionUi?.phase === 'CANCEL_AT_PERIOD_END';
  }, [subscriptionUi]);

  // 4. Step 4: Guard clause - if no freemium UI is needed, render nothing
  if (isSubscribed && !isFreemium) return null;

  return (
    /* 5. Step 5: Render the horizontal bar with #FFFFFF background and brand padding */
    <div 
      className="brand-ui flex items-center gap-3 px-3 py-2 pointer-events-auto"
    >
      {/* 6. Step 6: Conditionally render the Upgrade Button with original legacy classes */}
      {!isSubscribed && (
        <button
          onClick={onUpgrade}
          className="btn btn--upgrade btn-text-color"
          title="Upgrade Subscription"
        >
          <Zap size={16} fill="currentColor" />
          <span className="font-bold">Upgrade</span>
        </button>
      )}

      {/* 7. Step 7: Conditionally render the Demo Credits badge using original legacy styling (bg-gray-50) */}
      {isFreemium && (
        <div 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-600"
          title="Remaining lesson generation credits"
        >
          <span>Demo credits: {remainingDemoCredits}</span>
        </div>
      )}
    </div>
  );
};

export default FreemiumContextUiTriggers;