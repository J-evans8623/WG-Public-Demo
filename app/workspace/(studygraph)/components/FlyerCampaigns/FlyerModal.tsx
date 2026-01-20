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
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import { Sparkles, MapPin, Printer, Camera, Loader2, CheckCircle2, Clock, X, Trophy, Gift, Users } from 'lucide-react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';

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
  const { accountStatus, refresh } = useAccountStatus();
  
  // update - 5: Extract reached milestones from the sidecar-hydrated context
  const milestones = (accountStatus as any)?.reachedMilestones || [];

  // update - 1: Secondary view state for branching within a status (e.g., Eligible -> Form)
  const [internalView, setInternalView] = useState<'REWARDS' | 'FORM'>('REWARDS');
  
  const [university, setUniversity] = useState('');
  // update - 2: Lockout state to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  // update - 4: Success confirmation for the intake phase
  const [waitlistConfirmed, setWaitlistConfirmed] = useState(false);
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
  };

  // --- View Renderers ---

  const renderRewardTiers = () => (
    <div className="campaign-step">
      <div className="flex justify-center mb-4"><Trophy size={48} className="text-amber-500" /></div>
      <h2 className="modal-title text-center">Trial Rewards</h2>
      <p className="modal-text text-center mb-6">Unlock a premium free trial when you post a QR flyer to your first study group on campus.</p>
      
      <div className="space-y-4">
        {/* Tier 1: Initial Post */}
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="text-purple-600" size={24} />
            <div>
              <p className="font-bold text-sm">Post Your First Flyer</p>
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

        {/* Tier 2: 5 Invites */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${milestones.includes('tier_5') ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" size={24} />
            <div>
              <p className="font-bold text-sm">Get 5 Unique Scans</p>
              <p className="text-xs text-gray-500">+7 Additional Days</p>
            </div>
          </div>
          {milestones.includes('tier_5') && <CheckCircle2 className="text-green-500" size={20} />}
        </div>

        {/* Tier 3: 15 Invites */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${milestones.includes('tier_15') ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
          <div className="flex items-center gap-3">
            <Sparkles className="text-amber-600" size={24} />
            <div>
              <p className="font-bold text-sm">Get 15+ Unique Scans</p>
              <p className="text-xs text-gray-500">+14 Additional Days</p>
            </div>
          </div>
          {milestones.includes('tier_15') && <CheckCircle2 className="text-green-500" size={20} />}
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
      <div className="flex justify-center mb-4"><Printer size={48} className="text-purple-500" /></div>
      <h2 className="modal-title text-center">4 Steps to Your Trial</h2>
      <div className="space-y-4 mt-6 text-sm">
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">1</div>
          <p><strong>Create a notebook</strong> for a course you are currently taking.</p>
        </div>
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">2</div>
          {/* update - 3: Mandatory instructional integrity requirement */}
          <p><strong>Add at least two lesson</strong> using the AI lesson generator feature. We only reward active notebooks. We added additional lesson generation credits to your account already.</p>
        </div>
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">3</div>
          <p>Go to &apos;Share&apos;, <strong>Print the flyer</strong>, and post it on campus on your way to class.</p>
        </div>
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">4</div>
          <p>Take a photo of your flyer and upload it below for approval.</p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-100">
        <h3 className="font-bold flex items-center gap-2 mb-3"><Camera size={18} /> Upload Photo Proof</h3>
        {!uploadSuccess ? (
          <div className="space-y-3">
            <input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="text-xs" />
            <button disabled={!uploadFile || isUploading} onClick={handleUploadProof} className="btn btn-primary w-full">
              {isUploading ? <Loader2 className="animate-spin mx-auto" /> : 'Submit Proof'}
            </button>
          </div>
        ) : (
          <div className="p-2 bg-green-500 text-white rounded text-center font-bold text-sm">Proof Received!</div>
        )}
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
      <div className="modal-container max-w-md relative p-8" onClick={(e) => e.stopPropagation()}>
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