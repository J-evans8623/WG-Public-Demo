// app/Library/components/ShareModal.tsx
/**
 * (update - 50)
 * Header: add Settings icon next to Close in success scene
 * Success actions: bottom-right bar with Done only
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ShareModal.css';
import { X, Copy, Check, Settings } from 'lucide-react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { usePublicShare, ShareMode, PublicShareResult } from '../../hooks/sharing/usePublicShare';

interface ShareModalProps { isOpen: boolean; onClose: () => void; }
function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { docFileID } = useYDoc();
  const { isLoading, error, configureSharing, clearError } = usePublicShare();

  const [shareMode, setShareMode] = useState<ShareMode>('public-view');
  const [editors, setEditors] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [result, setResult] = useState<PublicShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const helperText = useMemo(() => {
    switch (shareMode) {
      case 'public-view': return 'Anyone with the link can view this document. Edits are disabled.';
      case 'public-edit': return 'Anyone with the link can view and edit this document.';
      case 'private':     return 'Only the editors you add here can edit. Others cannot access edits via the link.';
      default:            return '';
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
    }
  }, [isOpen, clearError]);

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

  const handleOpenLink = useCallback(() => {
    if (result?.url) window.open(result.url, '_blank', 'noopener,noreferrer');
  }, [result?.url]);

  if (!isOpen) return null;

  const isConfigureScene = !result && !isLoading;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Share modal">
      <div className="modal-container sm-shell" style={{ width: 560, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="sm-header">
          <h2 className="modal-title" style={{ margin: 0, textAlign: 'left' }}>Share Document</h2>

          {/* (update - 51) When in success scene, show Settings icon to the left of X */}
          <div className="sm-header-actions">
            {result && !isLoading && (
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
          {result && !isLoading && (
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

              {/* (update - 52) Bottom-right action bar with Done */}
              <div className="sm-success-actions-bar">
                <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
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
