/**
 * @file CampaignUIOrchestrator.tsx (Encapsulation Update)
 * @description
 * Patched to use the useCampaignTrial sidecar hook. This resolves the 
 * countdown visibility issue without touching the useAccountStatus hook.
 * 
 * This version has less friction, particiapnts only have to sign up , create a notebook, add lessons to it and share link.
 */

import React from 'react';
// update - 1: Import the new sidecar hook
import { useAccountStatus, useCampaignTrial } from '@/app/src/context/ApiContext';
import { useGlobalModal } from '@/app/workspace/(studygraph)/components/modals/GlobalModalProvider';
import { Sparkles, Clock, CheckCircle, ArrowRight, Timer, Search } from 'lucide-react';

export const CampaignUIOrchestrator: React.FC = () => {
  // update - 2: Extract campaign-specific data from the sidecar
  const { daysRemaining, isActiveTrial, campaignStatus } = useCampaignTrial();
  const { accountStatus, subscriptionUi } = useAccountStatus();
  const { showModal } = useGlobalModal();
  
  // Traditional premium users (Stripe) still get hidden
  const isTraditionalPremium = subscriptionUi?.effectiveTier === 'premium' && !isActiveTrial;
  
  if (isTraditionalPremium || !campaignStatus || campaignStatus === 'INELIGIBLE') {
    return null;
  }

  const handleBannerClick = () => {
    showModal('flyerCampaignModal', {
      status: campaignStatus,
      email: accountStatus?.email,
    });
  };

  const renderBannerContent = (

  ) => {
    // update - 3: PATCHED Objective 3 - Trial Countdown State
    // We now use the 'daysRemaining' provided by the sidecar
    if (isActiveTrial) {
      return {
        icon: <Timer className="text-purple-500" size={20} />,
        title: `${daysRemaining} DAYS OF TRIAL REMAINING`,
        colorClass: "bg-purple-50 border-purple-200"
      };
    }


    switch (campaignStatus) {
        
      case 'PENDING':
        return {
          icon: <Clock className="text-amber-500" size={20} />,
          title: "Application Pending",
          subtitle: "We're reviewing your submission for eligibility. Check back soon for rewards!",
          cta: "Rewards",
          colorClass: "bg-amber-50 border-amber-200"
        };
      case 'APPROVED':
        return {
          icon: <CheckCircle className="text-green-500" size={20} />,
          title: "You're Approved!",
          subtitle: "View the 3 mandatory steps to redeem your 7-day trial.",
          cta: "Redeem",
          colorClass: "bg-green-50 border-green-200"
        };
      default: // ELIGIBLE
        return {
          icon: <Sparkles className="text-purple-500" size={20} />,
          title: "Get a 7 day free trial.",
          subtitle: "Share your notebook with 5 new peers to unlock your trial! (only new users are counted)",
          cta: "See Rewards and Sign up",
          colorClass: "bg-purple-50 border-purple-200"
        };
    }
  };

  const content = renderBannerContent();

  return (
    <div 
      className={`campaign-banner p-4 mb-6 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${content.colorClass}`}
      onClick={handleBannerClick}
    >
      <div className="flex items-center gap-4">
        <div className="p-2 bg-white rounded-full shadow-sm">
          {content.icon}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 leading-tight uppercase tracking-tight">
            {content.title}
          </h4>
          <p className="text-sm text-gray-600">{content.subtitle}</p>
        </div>
      </div>
      
      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">
        {content.cta}
        <ArrowRight size={16} />
      </button>
    </div>
  );
};