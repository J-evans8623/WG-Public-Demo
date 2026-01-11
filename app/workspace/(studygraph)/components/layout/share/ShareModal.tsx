// app/Library/components/ShareModal.tsx
/**
 * (update - 53)
 * Header: Added Printer icon to imports
 * Success actions: Added "Print QR Flyer" workflow
 * Flyer Mode: Added state and UI for customizing and printing a QR flyer
 * Print Logic: Client-side HTML generation for window.print()
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ShareModal.css';
import { X, Copy, Check, Settings, Printer, ArrowLeft } from 'lucide-react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { usePublicShare, ShareMode, PublicShareResult } from '../../hooks/sharing/usePublicShare';
import { useApiContext, useFileList } from '@/app/src/context/ApiContext';

interface ShareModalProps { isOpen: boolean; onClose: () => void; }
function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { docFileID } = useYDoc();
  const { isLoading, error, configureSharing, clearError, fetchShareLink } = usePublicShare();

  const [shareMode, setShareMode] = useState<ShareMode>('public-view');
  const [editors, setEditors] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [result, setResult] = useState<PublicShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { userEmail } = useApiContext();
  const { ownedFiles, sharedFiles } = useFileList();



  // Determines if the signed-in user is the owner of the current document
  const isOwner = useMemo(() => {
    if (!docFileID || !userEmail) return false;
    // Check both lists to find the metadata for the current document
    const file = ownedFiles.find(f => f.fileId === docFileID)
    
    // Safety check: if file not found in lists, default to false (safe failure)
    return file ? true:false;
  }, [docFileID, userEmail, ownedFiles]);

  // 1. New state for Flyer feature
  const [flyerMode, setFlyerMode] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');

  const helperText = useMemo(() => {
    switch (shareMode) {
      case 'public-view': return 'Anyone with the link can view this document. Edits are disabled.';
      case 'public-edit': return 'Anyone with the link can view and edit this document.';
      case 'private':      return 'Only the editors you add here can edit. Others cannot access edits via the link.';
      default:             return '';
    }
  }, [shareMode]);

  const successNote = useMemo(() => {
    if (!result) return { text: '', variant: '' as 'public' | 'private' | '' };
    if (result.mode === 'private') {
      return { text: 'Only the editors you added can edit; others won’t have edit access.', variant: 'private' as const };
    }
    const action = result.mode === 'public-edit' ? 'edit' : 'view';
    return { text: `Anyone with this link can ${action}.`, variant: 'public' as const };
  }, [result]);

useEffect(() => {
    if (isOpen) {
      setShareMode('public-view');
      setEditors([]);
      setEmailInput('');
      setResult(null);
      setCopied(false);
      clearError();
      setFlyerMode(false);
      setCourseTitle('');
    }
  }, [isOpen]);


  // update - 4: New Effect specifically for data fetching. 
  // This can run safely without resetting your UI state.
  useEffect(() => {
    if (isOpen && docFileID && !isOwner) {
       fetchShareLink(docFileID)
         .then(data => setResult(data))
         .catch(err => console.error('[ShareModal] Auto-fetch failed', err));
    }
  }, [isOpen, docFileID, isOwner, fetchShareLink]);


  

  const addEmail = useCallback((email: string) => {
    const clean = email.trim().toLowerCase();
    if (clean && isValidEmail(clean) && !editors.includes(clean)) setEditors(p => [...p, clean]);
  }, [editors]);

  const removeEmail = useCallback((e: string) => setEditors(p => p.filter(x => x !== e)), []);
  const handleEmailInput = useCallback((v: string) => {
    if (!v.trim()) return;
    v.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(addEmail);
    setEmailInput('');
  }, [addEmail]);

  const handleEmailKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleEmailInput(emailInput); }
  }, [emailInput, handleEmailInput]);

  const handleApplySharing = useCallback(async () => {
    if (!docFileID) return;
    try {
      const sharingResult = await configureSharing({
        docId: docFileID, mode: shareMode, delivery: 'link', editors: shareMode === 'private' ? editors : []
      });
      setResult(sharingResult);
    } catch (err) { console.error('[ShareModal][apply] failed', err); }
  }, [docFileID, shareMode, editors, configureSharing]);

  const handleCopyUrl = useCallback(async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea'); ta.value = result.url;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [result?.url]);

  // 2. Logic to generate and print the flyer via browser API
  const handlePrintFlyer = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !result?.qrDataUri) return;

    // Construct the printable HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Study Group Flyer</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&display=swap" rel="stylesheet">
          <style>
            @page { margin: 0; size: auto; }
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
            .flyer-container {
              position: relative;
              width: 100%;
              height: 100vh;
              background-image: url('/brand/qr-flyer-study-group-wg.webp');
              background-size: cover;
              background-position: center top;
              background-repeat: no-repeat;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              overflow: hidden;
            }
            .header-text {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 14%; /* Matches the crimson bar area */
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-family: 'Alfa Slab One', cursive; 
              font-weight: 400;
              font-size: 6vw;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-align: center;
              padding: 0 20px;
              box-sizing: border-box;
            }
            .qr-wrapper {
              position: absolute;
              top: 28%; /* Vertically positioned in the white box area */
              left: 50%;
              transform: translateX(-50%);
              width: 45%; /* Relative width to fit the box */
              aspect-ratio: 1/1;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-code {
              width: 100%;
              height: 100%;
              object-fit: contain;
              mix-blend-mode: multiply;
            }
          </style>
        </head>
        <body>
          <div class="flyer-container">
            <div class="header-text">${courseTitle || 'Study Group'}</div>
            <div class="qr-wrapper">
              <img src="${result.qrDataUri}" class="qr-code" />
            </div>
          </div>
          <script>
            // Ensure image loads before printing
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [courseTitle, result?.qrDataUri]);

  if (!isOpen) return null;

  const isConfigureScene = !result && !isLoading && isOwner;
  const isSuccessScene = result && !isLoading && !flyerMode;
  const isFlyerScene = result && !isLoading && flyerMode;

  const showLoading = isLoading || (!isOwner && !result);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Share modal">
      <div className="modal-container sm-shell" style={{ width: 560, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="sm-header">
          {/* 3. Conditional Title based on Scene */}
          <h2 className="modal-title" style={{ margin: 0, textAlign: 'left' }}>
            {isFlyerScene ? 'Print QR Flyer' : 'Share Document'}
          </h2>

          <div className="sm-header-actions">
            {isSuccessScene && (
              <button
                type="button"
                className="sm-icon-btn"
                onClick={() => setResult(null)}
                aria-label="Change settings"
                title="Change settings"
              >
                <Settings size={18} />
              </button>
            )}
            <button className="sm-close" onClick={onClose} aria-label="Close" title="Close" type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="sm-body">
          {/* Scene 1 — Configure */}
          {isConfigureScene && (
            <div className="sm-body-inner sm-stack">
              <div className="form-section">
                <label className="form-label">Current Access Level</label>
                <div className="sm-select">
                  <select
                    value={shareMode}
                    onChange={(e) => setShareMode(e.target.value as ShareMode)}
                    className="text-input sm-select-native"
                  >
                    <option value="public-edit">Anyone with the link can edit</option>
                    <option value="public-view">Anyone with the link can view</option>
                    <option value="private">Only editors on the list can edit</option>
                  </select>
                </div>
                <div className="modal-subtext sm-helper">{helperText}</div>
              </div>

              {shareMode === 'private' && (
                <div className="rms-field">
                  <div className="rms-legend">Add editors (email addresses)</div>
                  {editors.length > 0 && (
                    <div className="sm-tags">
                      {editors.map((email) => (
                        <span key={email} className="sm-tag">
                          {email}
                          <button type="button" className="sm-tag-x" aria-label={`Remove ${email}`} onClick={() => removeEmail(email)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    onBlur={() => handleEmailInput(emailInput)}
                    placeholder="Enter emails separated by commas or new lines"
                    className="text-input sm-textarea"
                  />
                  <div className="modal-subtext" style={{ margin: 0 }}>Press Enter or comma to add multiple emails.</div>
                </div>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="loading-section">
              <div className="pulsing-dots" aria-hidden="true"><span className="dot" /><span className="dot" /><span className="dot" /></div>
              <div className="loading-text">Configuring sharing settings…</div>
              <div className="modal-subtext">This will just take a moment.</div>
            </div>
          )}

          {/* Scene 2 — Success */}
          {isSuccessScene && (
            <div className="sm-stack">
              <div className="sm-success-head">
                <div className="sm-success-avatar"><Check className="sm-success-check" /></div>
                <div className="sm-success-titles">
                  <h3 className="sm-success-title">Your link is ready to be shared</h3>
                  <p className="sm-success-sub">Your sharing settings have been updated</p>
                </div>
              </div>

              <div className="sm-share-block">
                <label className="sm-share-label">Share Link</label>
                <div className="sm-share-row">
                  <p className="sm-share-url" title={result.url}>{result.url}</p>
                  <div className="sm-share-actions">
                    <button onClick={handleCopyUrl} className="sm-share-btn sm-share-btn--copy" title="Copy to clipboard" aria-label="Copy to clipboard">
                      {copied ? <Check className="sm-share-ic" /> : <Copy className="sm-share-ic" />}
                      <span className="sm-share-btn-text">{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {successNote.text && (
                <div className={`sm-perm sm-perm--${successNote.variant}`}>
                  <div className="sm-perm-dot" />
                  <div className="sm-perm-texts">
                    <p className="sm-perm-title">{successNote.variant === 'public' ? 'Public Access' : 'Restricted Access'}</p>
                    <p className="sm-perm-sub">{successNote.text}</p>
                  </div>
                </div>
              )}

              {/* 4. Success Actions including "Print QR Flyer" */}
              <div className="sm-success-actions-bar">
                 <button
                   type="button"
                   className="btn btn-secondary"
                   onClick={() => setFlyerMode(true)}
                   style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                 >
                   <Printer size={16} />
                   Print QR Flyer
                 </button>
                <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          )}

          {/* Scene 3 — Flyer Configuration */}
          {isFlyerScene && (
            <div className="sm-stack">
              <div className="form-section">
                <label className="form-label">Course / Group Title</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Biology 101 Study Group"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
                <div className="modal-subtext">This text will appear at the top of your flyer.</div>
              </div>

              <div className="sm-flyer-preview-container">
                <div className="sm-flyer-label">Live Preview</div>
                <div className="sm-flyer-preview">
                  {/* Background Image is set in CSS via class */}
                  <div className="sm-flyer-bg-img" />
                  
                  {/* Overlays */}
                  <div className="sm-flyer-overlay-title">
                    {courseTitle || <span style={{ opacity: 0.5 }}>Your Title Here</span>}
                  </div>
                  <div className="sm-flyer-overlay-qr">
                    {result?.qrDataUri && (
                      <img src={result.qrDataUri} alt="QR Code" className="sm-flyer-qr-img" />
                    )}
                  </div>
                </div>
              </div>

              <div className="sm-footer sm-footer--borderless" style={{ padding: '16px 0 0' }}>
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => setFlyerMode(false)}
                >
                  <ArrowLeft size={16} style={{ marginRight: 4 }} />
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePrintFlyer}
                >
                  <Printer size={16} style={{ marginRight: 6 }} />
                  Print Flyer
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer (Scene 1 only) */}
        {isConfigureScene && (
          <div className={`sm-footer ${isConfigureScene ? 'sm-footer--borderless' : ''}`}>
            <button type="button" className="btn btn-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className={`btn ${shareMode === 'private' && editors.length === 0 ? 'btn-disabled' : 'btn-primary'}`}
              onClick={handleApplySharing}
              disabled={shareMode === 'private' && editors.length === 0}
            >
              Apply Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}