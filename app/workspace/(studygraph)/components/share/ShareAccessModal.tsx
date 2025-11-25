import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import './ShareAccessModal.css';

export type AccessLevel = 'anyone' | 'editors' | 'readonly';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  docLink: string;
  initialAccess?: AccessLevel;
  /**
   * Called on Apply. You can wire this to:
   * - setPublicEdit / setPublicView
   * - addEditor / removeEditor
   */
  onApply?: (payload: { accessLevel: AccessLevel; emails: string[] }) => Promise<void> | void;
  onPrintQr?: () => void; // optional hook for QR printing flow
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ShareAccessModal: React.FC<Props> = ({
  isOpen,
  onClose,
  docLink,
  initialAccess = 'readonly',
  onApply,
  onPrintQr,
}) => {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(initialAccess);
  const [emails, setEmails] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccessLevel(initialAccess);
      setEmails([]); // reset on each open; tweak if you want to preserve
      setCopied(false);
      // lock scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen, initialAccess]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const showEditors = accessLevel === 'editors';
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  function addEmail(raw: string) {
    const e = raw.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) return;
    setEmails(prev => prev.includes(e) ? prev : [...prev, e]);
  }

  function addMany(raw: string) {
    raw.split(/[,\n]/).forEach(addEmail);
  }

  function removeEmail(e: string) {
    setEmails(prev => prev.filter(x => x !== e));
  }

  async function copyLink() {
    try {
      // Prefer modern clipboard API
      await navigator.clipboard?.writeText(docLink);
    } catch {
      // fallback
      const t = document.createElement('textarea');
      t.value = docLink;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const Content = (
    <div
      className="sharemodal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        // close when clicking outside the modal
        if ((e.target as HTMLElement).classList.contains('modal-backdrop')) onClose();
      }}
      style={{ display: isOpen ? 'block' : 'none' }}
    >
      <div className="modal-backdrop">
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
        >
          <div className="modal-header">
            <h2 id="share-modal-title" className="modal-title">Share Document</h2>
            <button className="close-btn" aria-label="Close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {/* Document Link Section */}
            <div className="section">
              <div className="section-label">Document Link</div>
              <div className="link-input-container">
                <input className="link-input" type="text" readOnly value={docLink} />
              </div>
              <div className="action-buttons">
                <button
                  className={`btn btn-copy ${copied ? 'copied' : ''}`}
                  onClick={copyLink}
                >
                  <span className="icon">{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <button
                  className="btn btn-qr"
                  onClick={() => onPrintQr ? onPrintQr() : window.alert('QR Code printing dialog would open here')}
                >
                  <span className="icon">⊞</span>
                  <span>Print QR Code</span>
                </button>
              </div>
            </div>

            {/* Access Level Section */}
            <div className="section">
              <div className="section-label">Current Access Level</div>
              <select
                className="access-select"
                value={accessLevel}
                onChange={(e) => {
                  const v = e.target.value as AccessLevel;
                  setAccessLevel(v);
                  if (v === 'editors') setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                <option value="anyone">Anyone with the link can edit</option>
                <option value="editors">Only editors on the list can edit</option>
                <option value="readonly">Read only</option>
              </select>

              {/* Email Input Section */}
              <div className={`email-input-section ${showEditors ? 'visible' : ''}`}>
                <div className="email-input-label">Add editors (enter email addresses)</div>

                <div className="email-tags">
                  {emails.map(e => (
                    <div className="email-tag" key={e}>
                      <span>{e}</span>
                      <span
                        className="remove"
                        data-email={e}
                        onClick={() => removeEmail(e)}
                        role="button"
                        aria-label={`Remove ${e}`}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>

                <textarea
                  ref={inputRef}
                  className="email-textarea"
                  placeholder="Enter email addresses separated by commas or new lines"
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ',') {
                      ev.preventDefault();
                      const target = ev.target as HTMLTextAreaElement;
                      addMany(target.value);
                      target.value = '';
                    }
                  }}
                  onBlur={(ev) => {
                    const v = (ev.target as HTMLTextAreaElement).value;
                    if (v) {
                      addMany(v);
                      (ev.target as HTMLTextAreaElement).value = '';
                    }
                  }}
                />
                <div className="email-helper">Press Enter or use comma to add multiple emails</div>

                {/* Accumulated Emails Display */}
                <div className={`accumulated-emails ${emails.length ? 'has-emails' : ''}`}>
                  <div className="accumulated-emails-label">Added Editors</div>
                  <div className={`accumulated-emails-list ${emails.length ? '' : 'empty'}`}>
                    {emails.length ? emails.join(', ') : 'No editors added yet'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn-footer btn-cancel" onClick={onClose}>Cancel</button>
            <button
              className="btn-footer btn-apply"
              onClick={async () => {
                await onApply?.({ accessLevel, emails });
                onClose();
              }}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!portalTarget) return null;
  return ReactDOM.createPortal(Content, portalTarget);
};

export default ShareAccessModal;
