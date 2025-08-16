/**
 * @file app/Library/components/ShareModal.tsx
 * @description
 *   Modern share modal component that implements the new access control-based sharing system,
 *   replacing the deprecated token-based workflow. This component provides a clean interface
 *   for configuring document sharing through public access flags (publicView and publicEdit)
 *   rather than individual share tokens. It follows the refined design prototype with enhanced
 *   UX patterns including real-time email validation, editor tag management, and integrated
 *   QR code generation. The component supports three sharing modes: private (restricted to
 *   specific editors), public-view (read-only access via link), and public-edit (collaborative
 *   access via link). It generates direct document URLs that work seamlessly with the existing
 *   Yjs collaboration system and access control infrastructure, eliminating token redemption
 *   complexity while preserving marketing features like QR codes and flyer generation.
 * 
 * Responsibilities:
 *   - Render intuitive sharing interface with access level controls
 *   - Manage editor email validation and tag display
 *   - Generate and display QR codes for marketing purposes
 *   - Handle flyer PDF generation and download
 *   - Provide copy-to-clipboard functionality for share URLs
 *   - Integrate with public share API for access control updates
 *   - Display loading states and error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Printer } from 'lucide-react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { usePublicShare, ShareMode, PublicShareResult } from '../../hooks/sharing/usePublicShare';
import Image
 from 'next/image';
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Validates email address format using a comprehensive regex pattern that checks for
 * proper structure including local part, @ symbol, domain, and top-level domain.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  console.log('ShareModal.tsx 5001 › Modal render', { isOpen });

  // Step 1: Hook and context initialization
  const { docFileID } = useYDoc();
  const { isLoading, error, configureSharing, downloadFlyer, clearError } = usePublicShare();

  // Step 2: Component state management
  const [shareMode, setShareMode] = useState<ShareMode>('public-view');
  const [editors, setEditors] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [result, setResult] = useState<PublicShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Step 3: Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      console.log('ShareModal.tsx 5002 › Modal opened, resetting state');
      setShareMode('public-view');
      setEditors([]);
      setEmailInput('');
      setResult(null);
      setCopied(false);
      clearError();
    }
  }, [isOpen, clearError]);

  /**
   * Adds a new email to the editors list after validation, preventing duplicates
   * and ensuring proper email format. Updates the editor tag display immediately.
   */
  const addEmail = useCallback((email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    console.log('ShareModal.tsx 5003 › Adding email', { email: cleanEmail });
    
    if (cleanEmail && isValidEmail(cleanEmail) && !editors.includes(cleanEmail)) {
      const newEditors = [...editors, cleanEmail];
      setEditors(newEditors);
      console.log('ShareModal.tsx 5004 › Email added successfully', { 
        totalEditors: newEditors.length 
      });
    } else {
      console.log('ShareModal.tsx 5005 › Email rejected', { 
        email: cleanEmail,
        isValid: isValidEmail(cleanEmail),
        isDuplicate: editors.includes(cleanEmail)
      });
    }
  }, [editors]);

  /**
   * Removes an email from the editors list and updates the tag display.
   * Used when users click the remove button on email tags.
   */
  const removeEmail = useCallback((emailToRemove: string) => {
    console.log('ShareModal.tsx 5006 › Removing email', { email: emailToRemove });
    const newEditors = editors.filter(email => email !== emailToRemove);
    setEditors(newEditors);
  }, [editors]);

  /**
   * Processes email input by parsing comma-separated or newline-separated values
   * and adding each valid email to the editors list. Clears input after processing.
   */
  const handleEmailInput = useCallback((value: string) => {
    if (!value.trim()) return;
    
    console.log('ShareModal.tsx 5007 › Processing email input', { value });
    
    // Step 4: Parse multiple emails from input
    const emailList = value.split(/[,\n]/).map(email => email.trim()).filter(Boolean);
    
    // Step 5: Add each valid email
    emailList.forEach(email => addEmail(email));
    
    // Step 6: Clear input
    setEmailInput('');
  }, [addEmail]);

  /**
   * Handles keyboard input for email field, processing emails on Enter or comma,
   * and providing immediate feedback for invalid email formats.
   */
  const handleEmailKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleEmailInput(emailInput);
    }
  }, [emailInput, handleEmailInput]);

  /**
   * Configures document sharing settings by calling the public share API with current
   * form state. Handles both public sharing modes and private sharing with editor lists.
   */
  const handleApplySharing = useCallback(async () => {
    if (!docFileID) {
      console.error('ShareModal.tsx 5008 › No document ID available');
      return;
    }

    console.log('ShareModal.tsx 5009 › Applying sharing configuration', {
      docId: docFileID,
      mode: shareMode,
      editorsCount: editors.length
    });

    try {
      const sharingResult = await configureSharing({
        docId: docFileID,
        mode: shareMode,
        delivery: 'link',
        editors: shareMode === 'private' ? editors : []
      });

      setResult(sharingResult);
      console.log('ShareModal.tsx 5010 › Sharing configuration applied', {
        mode: sharingResult.mode,
        url: sharingResult.url,
        hasQr: !!sharingResult.qrDataUri
      });

    } catch (error) {
      console.error('ShareModal.tsx 5011 › Failed to apply sharing configuration', error);
    }
  }, [docFileID, shareMode, editors, configureSharing]);

  /**
   * Copies the share URL to the clipboard and provides visual feedback with a
   * temporary success state that automatically resets after 2 seconds.
   */
  const handleCopyUrl = useCallback(async () => {
    if (!result?.url) return;

    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      console.log('ShareModal.tsx 5012 › URL copied to clipboard', { url: result.url });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('ShareModal.tsx 5013 › Failed to copy URL', error);
    }
  }, [result?.url]);

  /**
   * Downloads the flyer PDF by opening it in a new tab, providing users with
   * print-ready promotional materials containing QR codes and document information.
   */
  const handleDownloadFlyer = useCallback(async () => {
    if (!docFileID) return;

    console.log('ShareModal.tsx 5014 › Generating flyer', { docId: docFileID });

    try {
      const flyerResult = await configureSharing({
        docId: docFileID,
        mode: shareMode,
        delivery: 'flyer',
        editors: shareMode === 'private' ? editors : []
      });

      if (flyerResult.flyerUrl) {
        downloadFlyer(flyerResult.flyerUrl);
        console.log('ShareModal.tsx 5015 › Flyer download initiated', { 
          flyerUrl: flyerResult.flyerUrl 
        });
      }
    } catch (error) {
      console.error('ShareModal.tsx 5016 › Flyer generation failed', error);
    }
  }, [docFileID, shareMode, editors, configureSharing, downloadFlyer]);

  // Step 7: Early return for closed modal
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Share Document</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6" style={{ backgroundColor: '#FAFBFC' }}>
          {!result && !isLoading && (
            <div className="space-y-6">
              {/* Access Level Section */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Current Access Level
                </div>
                <select
                  value={shareMode}
                  onChange={(e) => setShareMode(e.target.value as ShareMode)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white text-gray-900 cursor-pointer appearance-none"
                  style={{
                    borderColor: '#D4C4B0',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238795A1' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '36px'
                  }}
                >
                  <option value="public-edit">Anyone with the link can edit</option>
                  <option value="public-view">Anyone with the link can view</option>
                  <option value="private">Only editors on the list can edit</option>
                </select>

                {/* Email Input Section */}
                {shareMode === 'private' && (
                  <div 
                    className="mt-3 p-3 bg-white border rounded-md"
                    style={{ 
                      borderColor: '#E8E8E8',
                      animation: 'slideDown 0.3s ease-out'
                    }}
                  >
                    <div className="text-xs font-medium text-gray-900 mb-2">
                      Add editors (enter email addresses)
                    </div>
                    
                    {/* Email Tags */}
                    {editors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {editors.map((email) => (
                          <div
                            key={email}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 border rounded text-xs text-gray-900"
                            style={{ borderColor: '#D4C4B0' }}
                          >
                            <span>{email}</span>
                            <button
                              onClick={() => removeEmail(email)}
                              className="text-gray-500 hover:text-red-500 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      onBlur={() => handleEmailInput(emailInput)}
                      placeholder="Enter email addresses separated by commas or new lines"
                      className="w-full min-h-[60px] px-2 py-2 border rounded text-xs resize-vertical"
                      style={{ 
                        borderColor: '#D4C4B0',
                        backgroundColor: '#FAFBFC'
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Press Enter or use comma to add multiple emails
                    </div>

                    {/* Accumulated Emails Display */}
                    {editors.length > 0 && (
                      <div 
                        className="mt-3 p-2 bg-green-50 border rounded"
                        style={{ borderColor: '#D4C4B0' }}
                      >
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Added Editors
                        </div>
                        <div className="text-xs text-gray-900">
                          {editors.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Configuring sharing settings...
              </h3>
              <p className="text-sm text-gray-600">This will just take a moment</p>
            </div>
          )}

          {/* Success Result */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                >
                  <Check className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Sharing Configured!
                </h3>
                <p className="text-gray-600">
                  Your document sharing settings have been updated.
                </p>
              </div>

              {/* Copyable URL */}
              <div 
                className="p-4 rounded-xl border"
                style={{ backgroundColor: '#F9FAFB', borderColor: '#D4C4B0' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      Generated URL
                    </div>
                    <div 
                      className="text-sm text-gray-900 font-mono break-all p-3 rounded-lg border"
                      style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}
                    >
                      {result.url}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className={`flex-shrink-0 p-3 rounded-lg transition-all ${
                      copied
                        ? 'bg-green-100 text-green-600'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                    aria-label="Copy to clipboard"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
                {copied && (
                  <div className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Copied to clipboard!
                  </div>
                )}
              </div>

              {/* QR Code Display */}
              {result.qrDataUri && (
                <div className="space-y-2 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">QR Code</div>
                  <Image
                    src={result.qrDataUri} 
                    alt="Share QR code" 
                     width={200}
                     height={200}
                    className="mx-auto border rounded"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                  <button
                    onClick={handleDownloadFlyer}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    style={{ backgroundColor: '#3B82F6' }}
                  >
                    <Printer size={16} />
                    Download QR
                  </button>
                </div>
              )}

              {/* Editor Confirmation */}
              {result.mode === 'private' && result.editorsCount && result.editorsCount > 0 && (
                <div 
                  className="p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: '#EFF6FF', 
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center gap-2 text-blue-800">
                    <span className="text-sm font-medium">
                      Successfully configured for {result.editorsCount} editor(s)
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {editors.join(', ')}
                  </div>
                </div>
              )}

              {/* New Share Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setResult(null)}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Configure Different Settings
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !isLoading && (
            <div className="text-center py-8">
              <div className="text-sm text-red-600 mb-4">{error}</div>
              <button
                onClick={clearError}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!result && !isLoading && (
          <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white border text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
              style={{ borderColor: '#D4C4B0' }}
            >
              Cancel
            </button>
            <button
              onClick={handleApplySharing}
              disabled={shareMode === 'private' && editors.length === 0}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                shareMode === 'private' && editors.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'text-white hover:bg-green-700'
              }`}
              style={{ 
                backgroundColor: shareMode === 'private' && editors.length === 0 
                  ? '#E5E7EB' 
                  : '#5B8C5A'
              }}
            >
              Apply Changes
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}