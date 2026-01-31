/**
 * @file FlyerModal.tsx (Reactive State Overhaul)
 * @description
 * Rewritten to implement a Prop-Reactive State Machine. This overhaul ensures that
 * administrative approval in Firestore is instantly reflected in the UI, resolving
 * the procedural dead-end regression. Includes immediate submission lockout.
 * update - 1: Added explicit status-driven view selection to prioritize backend truth.
 * update - 2: Implemented isSubmitting lockout for input and button fields.
 * update - 3: Refactored instructions to mandate AI lesson generation.
 * update - 4: Added deterministic 'Waitlist Success' feedback stage.
 * update - 5: Synchronized milestone checkmarks with injected context data.
 * 
 * 
 * Share link version
 */

'use client';

import React, { useEffect, useState, } from 'react';
import { useAccountStatus, useCampaignTrial } from '@/app/src/context/ApiContext';
import {  MapPin, UserPlus, Loader2, CheckCircle2, Clock, X, Trophy, Gift, Users, Link } from 'lucide-react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import Image from 'next/image';

interface FlyerModalProps {
  onClose: () => void;
  status: 'ELIGIBLE' | 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REWARDED';
  email?: string;
}

/**
 * @function FlyerModal
 * @description
 * Reactively renders the campaign UI based on the authoritative 'status' prop.
 * Ensures zero-latency feedback during intake via a local submission lockout.
 */
export const FlyerModal: React.FC<FlyerModalProps> = ({ onClose, status, email }) => {
  const {  refresh } = useAccountStatus();

  // update - 1.2: Hydrate reactive metrics (count and status) from the sidecar
  const { totalUniquePeers, campaignStatus, refreshCampaign } = useCampaignTrial();
  
  // Calculate progress purely on the 5-peer requirement
  const progressPercent = Math.min((totalUniquePeers / 5) * 100, 100);


  // update - 1: Secondary view state for branching within a status (e.g., Eligible -> Form)
  const [internalView, setInternalView] = useState<'REWARDS' | 'FORM'>('REWARDS');
  
  const [university, setUniversity] = useState('');
  // update - 2: Lockout state to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  // update - 4: Success confirmation for the intake phase
  const [waitlistConfirmed, setWaitlistConfirmed] = useState(false);



  // update - 1.3: Trigger explicit sync upon modal mount to resolve data disconnect
  // This ensures the O(1) fetch for 'totalUniquePeers' happens as soon as the user opens the modal.
  useEffect(() => {
    refreshCampaign();
  }, [refreshCampaign]);
  
  /**
   * handleApply
   * @description
   * Manages the university intake workflow. It locks the UI immediately,
   * calls the BFF apply endpoint, and triggers a context refresh on success.
   */
  const handleApply = async () => {
    if (!university.trim()) return;
    setIsSubmitting(true); // update - 2: Lock UI immediately
    try {
      const resp = await fetch('/api/flyerCampaign/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityName: university }),
      });
      if (resp.ok) {
        await refresh();
        setWaitlistConfirmed(true); // update - 4: Move to success feedback
      }
    } catch (err) {
      console.error('Application failed', err);
    } finally {
      setIsSubmitting(false); // update - 2: Release lockout on completion
    }
  };
 /**
  const handleUploadProof = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const resp = await fetch('/api/flyerCampaign/submit-proof', {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        setUploadSuccess(true);
        await refresh();
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
    }
  }; */

  // --- View Renderers ---

  const renderRewardTiers = () => (
    <div className="campaign-step">
      <div className="flex justify-center mb-4"><Trophy size={48} className="text-amber-500" /></div>
      <h2 className="modal-title text-center">Free Trial Offer</h2>
      <p className="modal-text text-center mb-6">Redeem a premium free trial when you share your wisegraph notebook with five peers.</p>
      
      <div className="space-y-4">
        {/* Tier 1: Initial Post */}
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="text-purple-600" size={24} />
            <div>
              <p className="font-bold text-sm">Refer five Persons (only new users are counted)</p>
              <p className="text-xs text-gray-500">7 Days Premium Trial</p>
            </div>
          </div>
          {(status === 'VERIFIED' || status === 'REWARDED') ? (
            <CheckCircle2 className="text-green-500" size={20} />
          ) : status === 'ELIGIBLE' ? (
            <button onClick={() => setInternalView('FORM')} className="btn btn-primary px-4 py-2 text-xs">Apply Now</button>
          ) : (
            <Clock className="text-amber-500" size={20} />
          )}
        </div>
      </div>
      
      {status === 'PENDING' && (
        <div className="mt-6 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 text-center border border-amber-200 flex items-center gap-2 justify-center">
          <Clock size={14} /> Waitlist: We are reviewing your submission for eligibility.
        </div>
      )}
    </div>
  );

  const renderIntakeForm = () => (
    <div className="campaign-step text-center">
       {/* update - 4: Conditional success feedback screen */}
       {waitlistConfirmed ? (
         <div className="py-4">
           <div className="flex justify-center mb-4"><CheckCircle2 size={48} className="text-green-500" /></div>
           <h2 className="modal-title">You&apos;re on the list!</h2>
           <p className="modal-text">You have been added to our waitlist. We are processing your submission and will update your status shortly.</p>
           <button onClick={onClose} className="btn btn-primary w-full mt-6">Got it</button>
         </div>
       ) : (
         <>
           <div className="flex justify-center mb-4"><MapPin size={48} className="text-purple-500" /></div>
           <h2 className="modal-title">Where do you study?</h2>
           <p className="modal-text mb-4">We approve a limited number of offers per campus.</p>
           <input 
             type="text" 
             disabled={isSubmitting} // update - 2: Lock input during flight
             className="modal-input w-full p-3 border rounded-lg" 
             placeholder="e.g. State University" 
             value={university} 
             onChange={(e) => setUniversity(e.target.value)} 
           />
           <button 
             disabled={isSubmitting || !university} 
             onClick={handleApply} 
             className="btn btn-primary w-full mt-6"
           >
             {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Join Waitlist'}
           </button>
         </>
       )}
    </div>
  );

  const renderInstructions = () => (
    <div className="campaign-step">
      <div className="flex justify-center mb-4"><UserPlus size={48} className="text-purple-500" /></div>
      <h2 className="modal-title text-center">3 Steps to Your Trial</h2>

            {/* update - 6.1: Progress Tracker implementation replacing Legacy Photo Upload UI */}
      <div className="mt-8 p-6 bg-purple-50 rounded-xl border border-purple-100">
        <div className="flex justify-between items-end mb-2">
          <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2">
            <Link size={16} /> Progress
          </h3>
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">{totalUniquePeers} / 5 PEERS</span>
        </div>
        <div className="w-full bg-purple-200 rounded-full h-2.5">
          <div 
            className="bg-purple-600 h-2.5 rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-purple-500 mt-3 text-center uppercase tracking-widest font-bold">
          {totalUniquePeers >= 5 ? "Reward Unlocked!" : "Track your verified unique referrals here"}
        </p>
      </div>
      <div className="space-y-4 mt-6 text-sm">
        <div className="flex gap-3">

          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">1</div>
          <p><strong>Create a notebook</strong> for a course you are currently taking this semester.</p>
          </div>
          

        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">2</div>
          {/* update - 3: Mandatory instructional integrity requirement */}
          <p><strong>Add at least two lessons</strong> using the AI lesson generator feature. We only reward notebooks with lessons in them. We added additional lesson generation credits to help you with this step.</p>
        </div>
        <div className="rounded-lg border overflow-hidden bg-gray-50">
            <Image 
              src='/get-started/generate-lesson-menu-item.png' 
              alt="Generate Lesson Menu" 
              width={600} height={300} className="w-full h-auto opacity-90"
            />
          </div>
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">3</div>
          <p>Go to &apos;Share&apos;, <strong>Copy the link</strong>, and share it with your peers. Trial activates after inviting 5 new peers (must be new users).</p>
        </div>
        <div className="rounded-lg border overflow-hidden bg-gray-50">
            <Image 
              src='/get-started/share-collab-scene-1.png' 
              alt="Share Collaboration Scene" 
              width={600} height={300} className="w-full h-auto opacity-90"
            />
          </div>
      </div>
     </div>
  );

  /**
   * update - 1: Main Return Refactor
   * We now use 'status' as the authoritative high-priority switch.
   * APPROVED always triggers Instructions.
   * PENDING always triggers Rewards (showing waitlist message).
   * ELIGIBLE branches between Rewards and Form based on internalView.
   */
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-2xl relative p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X size={24} />
        </button>
        
        {/* Authoritative Prop-Reactive Logic Block */}
        {status === 'APPROVED' ? renderInstructions() : 
         (status === 'ELIGIBLE' && internalView === 'FORM') ? renderIntakeForm() : 
         renderRewardTiers()}
      </div>
    </div>
  );
};