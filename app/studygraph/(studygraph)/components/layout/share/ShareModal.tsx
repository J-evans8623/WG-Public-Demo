// app/Library/components/ShareModal.tsx

/**
 * @file ShareModal.tsx
 * @responsibility
 *   • Render the modal UI for generating share links, email invites, flyers, and QR codes.
 *   • Integrate with the `useShare` hook to call the share API and surface url, flyerUrl, and qrDataUri.
 *   • Provide download functionality for flyers and QR codes.
 *   • Log key events for observability (4000–4003).
 */

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Mail,
  Printer,
  Check,
  X,
  Link as LinkIcon,
  Users,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useShare, SharePayload, ShareResult } from './useShare';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  // Grab the current doc ID and the forkDoc helper
  const { docFileID: originalId, forkDoc, updateVisibility } = useYDoc();
  const { isLoading, error, createShare, downloadFlyer }     = useShare();

  const [shareType, setShareType] = useState<'copy' | 'collab'>('copy');
  const [expiry, setExpiry]       = useState<'1' | '7' | '30' | 'never'>('7');
  const [emails, setEmails]       = useState('');
  const [delivery, setDelivery]   = useState<'link' | 'email' | 'flyer'>('link');
  const [result, setResult]       = useState<ShareResult | null>(null);
  const [copied, setCopied]       = useState(false);

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('ShareModal.tsx 4000 ○ Modal opened, resetting state');
      setShareType('copy');
      setExpiry('7');
      setEmails('');
      setDelivery('link');
      setResult(null);
      setCopied(false);
    }
  }, [isOpen]);

  // Helper to download a Data-URI (QR code) as a file
  const downloadDataUri = (dataUri: string, filename: string) => {
    console.log('ShareModal.tsx 4001 ○ downloadDataUri start, filename=', filename);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('ShareModal.tsx 4002 ○ downloadDataUri completed for', filename);
  };

  // Main handler: fork if “copy”, then share
  const handleCreate = async () => {
    if (!originalId) return;
    let resourceId = originalId;

    // For a “copy” share, fork the Y.Doc first
    if (shareType === 'copy') {
      resourceId = await forkDoc();
    } else {
      updateVisibility('public');
    }

    // Build share payload
    const payload: SharePayload = {
      resourceId,
      mode: shareType,
      delivery,
    };
    if (shareType === 'collab' && expiry !== 'never') {
      payload.expiryDays = Number(expiry);
    }
    if (delivery === 'email') {
      payload.emails = emails
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);
    }

    try {
      const data = await createShare(payload);
      console.log('ShareModal.tsx 4003 ○ createShare returned:', {
        url: data.url,
        flyerUrl: data.flyerUrl,
        qrDataUriLength: data.qrDataUri?.length,
      });
      setResult(data);
    } catch {
      // error displayed via `error`
    }
  };

  const handleCopy = () => {
    if (!result?.url) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFlyer = () => {
    if (result?.flyerUrl) downloadFlyer(result.flyerUrl);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Share Your Project</h2>
              <p className="text-blue-100 mt-1 text-sm">Select sharing method</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* 1) Form */}
          {!result && !isLoading && (
            <div className="space-y-5">
              {/* Share Type */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Select Share Type</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShareType('copy')}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                      shareType === 'copy'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          shareType === 'copy' ? 'bg-blue-500' : 'bg-gray-400'
                        }`}
                      >
                        <LinkIcon className="text-white" size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Copy Link</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Forks and shares a fresh copy
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setShareType('collab')}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                      shareType === 'collab'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          shareType === 'collab' ? 'bg-blue-500' : 'bg-gray-400'
                        }`}
                      >
                        <Users className="text-white" size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Live Collaboration</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Share the current document for real-time editing
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Expiry */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-gray-500" />
                  <label className="font-medium text-gray-800">Expires in</label>
                </div>
                <select
                  value={expiry}
                  onChange={e => setExpiry(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="never">Never</option>
                </select>
              </div>

              {/* Email Recipients */}
              {delivery === 'email' && (
                <div className="space-y-2">
                  <label className="block font-medium text-gray-800 text-sm">
                    Email Recipients
                  </label>
                  <textarea
                    value={emails}
                    onChange={e => setEmails(e.target.value)}
                    placeholder="john@example.com, jane@example.com"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-16 resize-none text-sm"
                  />
                </div>
              )}

              {/* Primary Action */}
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={handleCreate}
                  disabled={delivery === 'email' && !emails.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
                    delivery === 'email'
                      ? emails.trim()
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  }`}
                >
                  {delivery === 'link' && <LinkIcon size={18} />}
                  {delivery === 'email' && <Mail size={18} />}
                  {delivery === 'flyer' && <Printer size={18} />}
                  {delivery === 'email'
                    ? 'Send Emails'
                    : delivery === 'flyer'
                    ? 'Generate Flyer'
                    : shareType === 'copy'
                    ? 'Generate & Copy Link'
                    : 'Generate & Copy Invite'}
                </button>
                {delivery === 'link' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setDelivery('email')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Mail size={16} /> Email
                    </button>
                    <button
                      onClick={() => setDelivery('flyer')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Printer size={16} /> Flyer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2) Loading Spinner */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {delivery === 'email'
                  ? 'Sending emails...'
                  : delivery === 'flyer'
                  ? 'Generating flyer...'
                  : 'Creating share link...'}
              </h3>
              <p className="text-sm text-gray-600">This will just take a moment</p>
            </div>
          )}

          {/* 3) Result */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {delivery === 'email'
                    ? 'Emails Sent!'
                    : delivery === 'flyer'
                    ? 'Flyer Created!'
                    : 'Link Generated!'}
                </h3>
                <p className="text-gray-600">
                  Your {shareType === 'copy' ? 'copy link' : 'collaboration invite'} is ready.
                </p>
              </div>

              {/* Copyable URL */}
              {delivery !== 'flyer' && (
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                        Generated URL
                      </div>
                      <div className="text-sm text-gray-900 font-mono break-all bg-white p-3 rounded-lg border">
                        {result.url}
                      </div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className={`flex-shrink-0 p-3 rounded-lg transition-all ${
                        copied
                          ? 'bg-green-100 text-green-600 ring-2 ring-green-200'
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
              )}

              {/* QR Code */}
              {result.qrDataUri && (
                <div className="space-y-2 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">QR Code</div>
                  <img src={result.qrDataUri} alt="Share QR code" className="mx-auto" />
                  <button
                    onClick={() => downloadDataUri(result.qrDataUri!, 'invite-qr.png')}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Download QR
                  </button>
                </div>
              )}

              {/* Email Confirmation */}
              {delivery === 'email' && emails && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Mail size={16} />
                    <span className="text-sm font-medium">
                      Successfully sent to {emails.split(',').length} recipient(s)
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {emails.split(',').map(e => e.trim()).join(', ')}
                  </div>
                </div>
              )}

              {/* Flyer Preview & Download */}
              {delivery === 'flyer' && result.flyerUrl && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-dashed border-purple-300">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Printer className="text-white" size={24} />
                      </div>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Print-Ready PDF
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-inner mb-4">
                        <div className="h-24 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-xs font-bold text-gray-800">
                              PROJECT SHARE
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              QR Code •{' '}
                              {shareType === 'copy' ? 'View Link' : 'Collaborate'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleDownloadFlyer}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
                      >
                        <ExternalLink size={16} />
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* New Share */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setResult(null)}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Create New Share
                </button>
              </div>
            </div>
          )}

          {/* Display Error */}
          {error && !isLoading && (
            <div className="text-center text-sm text-red-600 mt-4">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
