/**
 * @file AppModals.tsx
 * @description
 * Centralized modal collection that provides all application modal types through a unified
 * interface. This file consolidates subscription prompts, rate limit notifications, file
 * upload functionality, and enhanced lesson generation modals into a single maintainable
 * location. Each modal follows the established brand guidelines with consistent styling,
 * professional appearance, and appropriate user interactions. The modals integrate seamlessly
 * with the existing portal-based rendering system and account status management to provide
 * contextually appropriate functionality. All modals include comprehensive error handling,
 * loading states, and accessibility features to ensure a robust user experience.
 *
 * @author System
 * @date Current
 */
'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css'
import { useAccountStatus, useFileList } from '@/app/src/context/ApiContext';
import { generateAILesson } from '@/app/Library/utils/aiServiceApi';
import { modalEventManager } from '@/app/src/services/modalEventManager';
import { getModal } from '@/app/workspace/(studygraph)/components/modals/ModalRegistry';


// Modal types and props interfaces
export type ModalType = 'subscribe' | 'rateLimit' | 'fileUpload' | 'lessonGeneration' |'loadingOverlay'  | 'blockingProgress' | 'docUnavailable';


interface BaseModalProps {
  onClose: () => void;
  errorContext?: {
    type: string;
    service: string;
    requestId: string;
    retryAfter?: number;
  };
}

interface SubscribeModalProps extends BaseModalProps {
  featureName?: string;
  serviceContext?: string;
  onUpgrade?: () => void;
}

interface RateLimitModalProps extends BaseModalProps {
  retryAfter?: number;
  serviceContext?: string;
}

interface FileUploadModalProps extends BaseModalProps {
  onUploadSuccess: (file: File, isPublic: boolean) => void;
}

interface LessonGenerationModalProps extends BaseModalProps {
  onSuccess: (responseData: any, addToPlan?: boolean) => void;
  docFileId: string;
  checkTrackedStatus?: (id: string) => boolean;
  // Renamed prop to match new capability (was onIntegrate)
  onQueueIntegration?: (id: string) => void;
  isFreemium?: boolean;
  planNotebookCount?: number;
  onLimitReached?: () => void;
}

/** ─────────────────────────────────────────────────────────────────────────────
 * BlockingProgressModal (brand-styled, dimmed background like other modals)
 * Non-cancellable; no close button; no click-outside to dismiss.
 * Exactly the same overlay look/feel as Upload / LessonGeneration modals.
 * ─────────────────────────────────────────────────────────────────────────── */
interface BlockingProgressModalProps extends BaseModalProps {
  title?: string;
  message?: string;
  ariaLabel?: string;
}


/**
 * DocUnavailableModal (fatal boot UX)
 * @description
 *   Done-only modal used to surface a notebook boot error (e.g. deleted/private).
 *   This is intentionally simple and non-destructive: it explains what happened and
 *   allows the user to acknowledge and continue without getting stuck.
 */
interface DocUnavailableModalProps extends BaseModalProps {
  message?: string;
  title?: string;
  ariaLabel?: string;
}



export const DocUnavailableModal: React.FC<DocUnavailableModalProps> = ({
  onClose,
  message,
  title = 'Notebook unavailable',
  ariaLabel = 'Notebook unavailable',
}) => {
  // Proof: modal render
  console.warn('[WG_DOC_UNAV_200] DocUnavailableModal rendered.', { hasMessage: !!message });

  const resolvedMessage =
    message ?? 'The owner of this notebook has either deleted it or made it private.';

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="modal-container">
        <h2 className="modal-title">{title}</h2>

        <p className="modal-text" style={{ marginTop: 8 }}>
          {resolvedMessage}
        </p>

        <div className="button-section" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="btn btn-secondary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement);
};

export const BlockingProgressModal: React.FC<BlockingProgressModalProps> = ({
  // onClose is required by the infra but we don't expose any way to close while running
  onClose,
  title = 'Working…',
  message = '',
  ariaLabel = 'Progress',
}) => {
  const modalContent = (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      // prevent closing by overlay click
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'center' }}>{title}</h2>
        <div className="loading-section" style={{ marginTop: 8 }}>
          <PulsingDots />
          {message ? (
            <div className="loading-text" style={{ marginTop: 8 }}>
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('modal-root') as HTMLElement
  );
};

/**
 * @function LoadingDots
 * @description
 * Animated loading dots component that cycles through 0-3 dots every 500ms
 * to indicate ongoing processing.
 */
const LoadingDots: React.FC = () => {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return <span>{'.'.repeat(dotCount)}</span>;
};

/**
 * @function PulsingDots
 * @description
 * Three-dot pulsing animation component for loading states.
 */
const PulsingDots: React.FC = () => (
  <div className="pulsing-dots">
    <div className="dot"></div>
    <div className="dot"></div>
    <div className="dot"></div>
  </div>
);

/**
 * SubscribeModal (Enhanced with event context)
 * @description
 *   Enhanced subscription prompt modal that integrates error context information for
 *   contextual messaging and user guidance. This updated version maintains all existing
 *   functionality while adding support for service-specific messaging and error context
 *   that enables more relevant user feedback and upgrade prompts based on the specific
 *   service that triggered the subscription requirement.
 */
export const SubscribeModal: React.FC<SubscribeModalProps> = ({
  onClose,
  featureName = "This feature",
  serviceContext,
  onUpgrade,
  errorContext
}) => {

  //const router = useRouter();

  const handleUpgrade = () => {
    onUpgrade?.();
    onClose(); // Close modal first
    window.location.href = '/billing/offer';
  };

  // Step 3: Determine contextual messaging based on service and error context
  const getContextualMessage = () => {

    if (featureName === "Study Plan Limit") {
        return "Freemium accounts are limited to two notebook study plans. Subscribe to track unlimited notebooks.";
    }

    if (featureName && featureName.includes('free demo credits')) {
       // Result: "You can only use free demo credits on documents you own. Subscribe to unlock all features."
       return `${featureName} Subscribe to unlock all features.`;
    }

    if (serviceContext) {
      const serviceMessages = {
        askAssistant: 'AI Assistant features require a premium subscription for unlimited questions and advanced capabilities.',
        exploreTopic: 'Topic Exploration is a premium feature that provides in-depth analysis and learning recommendations.',
        createQuiz: 'Quiz Creation is a premium feature that generates customized assessments from your content.',
        lessonGeneration: 'Advanced Lesson Generation is a premium feature.'
      };
      return serviceMessages[serviceContext as keyof typeof serviceMessages] || 
             `${featureName} is a premium feature. Subscribe to unlock all features.`;
    }
    return `${featureName} is a premium feature. Subscribe to unlock all features.`;
  };

  const modalContent = (
    <div className="modal-overlay" style={{ zIndex: 2000 }} >
      <div className="modal-container" style={{ maxWidth: '550px', width: '95%' }} >
        <h2 className="modal-title">Upgrade to Premium</h2>
        <p className="modal-text">
          {getContextualMessage()}
        </p>

        {/* Pricing Comparison Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          
          {/* Scholar Tier */}
          <div style={{ 
            background: '#FAF8F5', 
            border: '1px solid #D4C4B0', 
            borderRadius: '8px', 
            padding: '16px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2C3E50', fontSize: '16px', fontWeight: 'bold' }}>Scholar</h4>
            <div style={{ color: '#5B8C5A', fontSize: '20px', fontWeight: 'bold' }}>$2.50 <span style={{fontSize:'12px', color:'#666'}}>/ week</span></div>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 12px 0' }}>Billed $10.00 monthly</p>
            
            <div style={{ borderTop: '1px dashed #D4C4B0', paddingTop: '8px', marginTop: '8px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#d97706' }}>BEST VALUE (50% OFF)</span>
              <div style={{ fontSize: '14px', fontWeight: '600', color:'#2C3E50' }}>$1.25 <span style={{fontSize:'10px', color:'#666'}}>/ week</span></div>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0 0' }}>Billed $59.99 annually</p>
            </div>
          </div>

          {/* Educator Tier */}
          <div style={{ 
            background: '#FAF8F5', 
            border: '1px solid #D4C4B0', 
            borderRadius: '8px', 
            padding: '16px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2C3E50', fontSize: '16px', fontWeight: 'bold' }}>Educator</h4>
            <div style={{ color: '#5B8C5A', fontSize: '20px', fontWeight: 'bold' }}>$3.25 <span style={{fontSize:'12px', color:'#666'}}>/ week</span></div>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 12px 0' }}>Billed $12.99 monthly</p>
            
            <div style={{ borderTop: '1px dashed #D4C4B0', paddingTop: '8px', marginTop: '8px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#d97706' }}>BEST VALUE (50% OFF)</span>
              <div style={{ fontSize: '14px', fontWeight: '600', color:'#2C3E50' }}>$1.63 <span style={{fontSize:'10px', color:'#666'}}>/ week</span></div>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0 0' }}>Billed $77.95 annually</p>
            </div>
          </div>

        </div>
        <p className="modal-subtext">
          Premium includes unlimited access to all AI features, advanced collaboration tools, and priority support.
        </p>
               
        <div className="button-section">
          <button
            onClick={onClose}
            className="btn btn-cancel"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgrade}
            className="btn btn-primary"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('modal-root') as HTMLElement
  );
};

/**
 * RateLimitModal (Enhanced with event context)
 * @description
 *   Enhanced rate limit notification modal that provides contextual retry timing and
 *   service-specific messaging based on the API error context. This updated version
 *   maintains user-friendly messaging while adding enhanced error context support
 *   for better debugging and user guidance during rate limit scenarios.
 */
export const RateLimitModal: React.FC<RateLimitModalProps> = ({
  onClose,
  retryAfter,
  serviceContext,
  errorContext
}) => {

  const getRetryMessage = () => {
    if (retryAfter && retryAfter > 0) {
      const minutes = Math.ceil(retryAfter / 60);
      return `Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return 'Please try again in a few moments.';
  };

  const getServiceSpecificMessage = () => {
    if (serviceContext) {
      const serviceMessages = {
        askAssistant: 'You have reached the rate limit for AI Assistant questions.',
        exploreTopic: 'You have reached the rate limit for Topic Exploration.',
        createQuiz: 'You have reached the rate limit for Quiz Creation.',
        lessonGeneration: 'You have reached the rate limit for Lesson Generation.'
      };
      return serviceMessages[serviceContext as keyof typeof serviceMessages] || 
             'You have reached the rate limit for this service.';
    }
    return 'The server is busy at the moment, please try again later.';
  };

  const modalContent = (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">Rate Limit Reached</h2>
        <p className="modal-text">
          {getServiceSpecificMessage()}
        </p>
        <p className="modal-subtext">
          {getRetryMessage()}
        </p>
        
        {errorContext && (
          <div className="error-context-info">
            <small className="text-gray-500">
              Request ID: {errorContext.requestId}
            </small>
          </div>
        )}
        
        <div className="button-section">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('modal-root') as HTMLElement
  );
};

/**
 * FileUploadModal (Preserved with enhanced error context)
 * @description
 * File upload modal with visibility controls that respect account permissions while adding
 * enhanced error context support for improved debugging and user feedback capabilities.
 */
export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  onClose,
  onUploadSuccess,
  errorContext
}) => {
  //console.log('[AppModals.tsx][5004] FileUploadModal rendered with enhanced context', { errorContext });

  const { hasFeature } = useAccountStatus();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const canUploadPublic = hasFeature('canCreatePublicFiles');

  //console.log('[AppModals.tsx][5005] Upload permissions - canUploadPublic:', canUploadPublic);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError('');
      //console.log('[AppModals.tsx][5006] File selected:', files[0].name);
    }
  };

  const handleVisibilityChange = (isPublicOption: boolean) => {
    if (isPublicOption && !canUploadPublic) {
      //console.log('[AppModals.tsx][5007] Public upload blocked for Scholar account');
      return;
    }
    setIsPublic(isPublicOption);
    //console.log('[AppModals.tsx][5008] Visibility changed to:', isPublicOption ? 'public' : 'private');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    //console.log('[AppModals.tsx][5009] Upload initiated - file:', selectedFile.name, 'public:', isPublic);
    
    setIsUploading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onUploadSuccess(selectedFile, isPublic);
      //console.log('[AppModals.tsx][5010] Upload completed successfully');
      onClose();
    } catch (err: any) {
      //console.error('[AppModals.tsx][5011] Upload failed:', err);
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">Upload File</h2>
        
        {isUploading ? (
          <div className="loading-section">
            <PulsingDots />
            <div className="loading-text">
              Uploading file<LoadingDots />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="form-label">Select File:</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.pptx"
                onChange={handleFileChange}
                className="file-input"
              />
            </div>

            <div className="form-section">
              <label className="form-label">Visibility:</label>
              <div className="radio-group">
                <div 
                  className={`radio-option ${!isPublic ? 'selected' : ''}`}
                  onClick={() => handleVisibilityChange(false)}
                >
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPublic}
                    onChange={() => handleVisibilityChange(false)}
                    className="radio-input"
                  />
                  <label className="radio-label">Private</label>
                </div>
                
                <div 
                  className={`radio-option ${isPublic ? 'selected' : ''} ${!canUploadPublic ? 'disabled' : ''}`}
                  onClick={() => handleVisibilityChange(true)}
                >
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPublic}
                    disabled={!canUploadPublic}
                    onChange={() => handleVisibilityChange(true)}
                    className="radio-input"
                  />
                  <label className="radio-label">
                    Public {!canUploadPublic && '(Educator only)'}
                  </label>
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {errorContext && (
              <div className="error-context-info">
                <small className="text-gray-500">
                  Request ID: {errorContext.requestId}
                </small>
              </div>
            )}

            <div className="button-section">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className={`btn ${isUploading || !selectedFile ? 'btn-disabled' : 'btn-primary'}`}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('modal-root') as HTMLElement
  );
};

/**
 * EnhancedLessonGenerationModal (Sequencing Fix)
 * @description
 * ...
 * UPDATE: Moved `integrateNotebook` execution OUT of this component.
 * Instead, it passes the user's `addToPlan` choice to the `onSuccess` callback.
 * This ensures the parent component only attempts to update the calendar AFTER
 * the generation API has definitively succeeded and returned data.
 */
export const EnhancedLessonGenerationModal: React.FC<LessonGenerationModalProps> = ({
  onClose,
  onSuccess,
  docFileId,
  errorContext,
  checkTrackedStatus, 
  onQueueIntegration,
  isFreemium = false,
  planNotebookCount = 0,
  onLimitReached      
}) => {
  //console.log('[AppModals.tsx][5012] EnhancedLessonGenerationModal rendered', { docFileId });

  const { hasFeature } = useAccountStatus();

  //  Get owned files to check for "New User" state
  const { ownedFiles } = useFileList();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const isTracked = checkTrackedStatus ? checkTrackedStatus(docFileId) : false;

  //  Calculate Auto-Select Logic for "time to value" optimization for new users
  // Condition: If not already tracked, AND Plan is empty, AND User has <= 2 files (Sample data only)
  const isOnboardingScenario = !isTracked && planNotebookCount === 0 && ownedFiles.length <= 2;


  const [addToPlan, setAddToPlan] = useState<boolean>(isTracked || isOnboardingScenario);
  const showCalendarOption = !!onQueueIntegration;
  
  const canCreatePublic = hasFeature('canCreatePublicFiles');

  // ... (handlers for file/visibility unchanged) ...
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { /*...*/ setSelectedFile(e.target.files?.[0] || null); setError(''); };
  const handleVisibilityChange = (isPublicOption: boolean) => { if (isPublicOption && !canCreatePublic) return; setIsPublic(isPublicOption); };


  const handleAddToPlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecking = e.target.checked;

    // Logic: If user is checking the box (adding), AND it's not already tracked,
    // AND they are freemium, AND they have 2 or more notebooks...
    if (isChecking && !isTracked && isFreemium && planNotebookCount >= 2) {
       // Trigger the subscription modal immediately
       if (onLimitReached) onLimitReached();
       // Prevent the checkbox from getting checked
       return;
    }

    setAddToPlan(isChecking);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    setIsLoading(true);
    setError('');

    // Testing freezed pixel bug : Force browser to paint loading UI before starting upload
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve); // Double RAF ensures paint completes
    });
  });



    try {
      const responseData = await generateAILesson(selectedFile, docFileId, { isPublic });
      //console.log('[AppModals.tsx][5018] Lesson generation completed successfully');
      
      // update - 3: Pass the choice back to the parent.
      // We do NOT await integration here anymore. We let the parent handle the sequence.
      onSuccess(responseData, addToPlan);
      
      onClose();
    } catch (err: any) {
      //console.error('[AppModals.tsx][5019] Lesson generation failed:', err);
      setError(err?.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">Generating Lesson</h2>
        
        {isLoading ? (
          <div className="loading-section">
            <PulsingDots />
            <div className="loading-text">
              {isLoading ? 'Creating lesson...' : 'Creating lesson...'} <LoadingDots />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="form-label">Source File:</label>
              <input type="file" accept=".pdf,.doc,.docx,.txt,.pptx" onChange={handleFileChange} className="file-input" />
            </div>

            <div className="form-section">
               {/* ... Visibility UI ... */}
               <label className="form-label">Upload Visibility:</label>
               {/* ... Radio buttons ... */}
               <div className="radio-group">
                <div className={`radio-option ${!isPublic ? 'selected' : ''}`} onClick={() => handleVisibilityChange(false)}>
                  <input type="radio" name="lessonVisibility" checked={!isPublic} onChange={() => handleVisibilityChange(false)} className="radio-input" />
                  <label className="radio-label">Private</label>
                </div>
                <div className={`radio-option ${isPublic ? 'selected' : ''} ${!canCreatePublic ? 'disabled' : ''}`} onClick={() => handleVisibilityChange(true)}>
                  <input type="radio" name="lessonVisibility" checked={isPublic} disabled={!canCreatePublic} onChange={() => handleVisibilityChange(true)} className="radio-input" />
                  <label className="radio-label">Public {!canCreatePublic && '(Educator only)'}</label>
                </div>
              </div>
            </div>

            {/* Checkbox UI (Visual only now, logic lifted) */}
            {showCalendarOption && (
              <div className="form-section" style={{marginTop: '20px'}}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                   <input 
                     type="checkbox" 
                     id="addToPlan"
                     checked={addToPlan}
                     onChange={handleAddToPlanChange}
                     className="radio-input"
                   />
                   <label htmlFor="addToPlan" className="radio-label" style={{cursor: 'pointer'}}>
                     {isTracked ? "Update study plan?" : "Add notebook to study plan?"}
                   </label>
                 </div>
                 <p className="modal-subtext" style={{textAlign: 'left', marginTop: '4px', fontSize: '12px'}}>
                   {isTracked 
                     ? "Syncs new lesson content with your existing schedule." 
                     : "Automatically adds this subject to your calendar starting today."}
                 </p>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {/* ... Error context ... */}

            <div className="button-section">
              <button type="button" onClick={onClose} className="btn btn-cancel">Cancel</button>
              <button type="submit" disabled={isLoading || !selectedFile} className={`btn ${isLoading || !selectedFile ? 'btn-disabled' : 'btn-secondary'}`}>
                {isLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement);
};


/**
 * createModal (Preserved with enhanced error context support)
 * @description
 * Factory function that creates and renders specific modal types based on the provided
 * type and props while supporting enhanced error context for improved user feedback.
 */
export const createModal = (type: ModalType, props: any) => {


  const externalFactory = getModal(type as string);
  if (externalFactory) {
    return externalFactory(props);
  }
  
  switch (type) {
    case 'subscribe':
      return <SubscribeModal {...props} />;
    case 'rateLimit':
      return <RateLimitModal {...props} />;
    case 'fileUpload':
      return <FileUploadModal {...props} />;
    case 'lessonGeneration':
      return <EnhancedLessonGenerationModal {...props} />;
    case 'blockingProgress':                             
      return <BlockingProgressModal {...props} />;
    case 'docUnavailable':
      return <DocUnavailableModal {...props} />;
    default:
      //console.error('[AppModals.tsx][5021] Unknown modal type requested:', type);
      return null;
  }
};

/**
 * useModalManager (Enhanced with event-driven integration)
 * @description
 *   Enhanced modal management hook that integrates with the ModalEventManager for automatic
 *   event-driven modal triggering while maintaining backward compatibility with existing
 *   programmatic modal usage. This updated hook supports both manual modal management and
 *   automatic triggering based on API error events for comprehensive modal handling.
 */
export const useModalManager = () => {
  const [activeModal, setActiveModal] = useState<{
    type: ModalType;
    props: any;
  } | null>(null);

  const modalManagerRef = useRef(false);

  // Step 4: Initialize event-driven modal integration
  useEffect(() => {
    const initializeModalEventManager = async () => {
      if (modalManagerRef.current) return;

      //console.log('[AppModals.tsx][5022] Initializing event-driven modal integration');

      try {
        await modalEventManager.initialize((modalType: ModalType, props: any) => {
          //console.log('[AppModals.tsx][5023] Event-driven modal triggered', { modalType });
          setActiveModal({
            type: modalType,
            props: {
              ...props,
              onClose: () => {
                //console.log('[AppModals.tsx][5024] Event-driven modal closed', { modalType });
                setActiveModal(null);
                // Let the event manager handle the close callback
                if (props.onClose) {
                  props.onClose();
                }
              }
            }
          });
        });

        modalManagerRef.current = true;
        //console.log('[AppModals.tsx][5025] Event-driven modal integration initialized successfully');
      } catch (error) {
        //console.error('[AppModals.tsx][5026] Failed to initialize modal event manager:', error);
      }
    };

    initializeModalEventManager();

    // Cleanup on unmount
    return () => {
      if (modalManagerRef.current) {
        modalEventManager.shutdown();
        modalManagerRef.current = false;
      }
    };
  }, []);

  const showModal = useCallback((type: ModalType, props: any = {}) => {
    //console.log('[AppModals.tsx][5027] Manual modal triggered:', type);
    setActiveModal({
      type,
      props: {
        ...props,
        onClose: () => {
          //console.log('[AppModals.tsx][5028] Manual modal closed:', type);
          setActiveModal(null);
          props.onClose?.();
        }
      }
    });
  }, []);

  const hideModal = useCallback(() => {
    //console.log('[AppModals.tsx][5029] Hiding active modal');
    setActiveModal(null);
  }, []);

  return {
    activeModal,
    showModal,
    hideModal,
    ModalRenderer: () => activeModal ? createModal(activeModal.type, activeModal.props) : null
  };
};