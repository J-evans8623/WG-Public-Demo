/**
 * @file GenerateLessonModal.tsx
 * @description
 *   A portal‐mounted modal for AI lesson generation. 
 *   - Accepts a selected File and the YDoc document ID (docFileId).
 *   - Invokes aiServiceApi.generateAILesson(file, docFileId).
 *   - On success, bubbles the response back to the parent.
 */

import React, { useState, ChangeEvent, FormEvent } from 'react';
import ReactDOM from 'react-dom';
import { generateAILesson } from '@/app/Library/utils/aiServiceApi';

interface GenerateLessonModalProps {
  /** Called to close the modal without generating */
  onClose: () => void;
  /** Called with the API response once generation succeeds */
  onSuccess: (responseData: any) => void;
  /** The file ID stored in the YDoc context to send to the backend */
  docFileId: string;
}

const GenerateLessonModal: React.FC<GenerateLessonModalProps> = ({
  onClose,
  onSuccess,
  docFileId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /** Update state when the user picks a file */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError('');
    }
  };

  /** Submit the file + docFileId to the AI service */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const responseData = await generateAILesson(selectedFile, docFileId);
      onSuccess(responseData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Styles for overlay and modal
  const overlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  };
  const container: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
  };
  const header: React.CSSProperties = {
    marginBottom: '10px',
    fontSize: '1.5rem',
    textAlign: 'center',
  };
  const errorStyle: React.CSSProperties = { color: 'red', marginTop: '10px' };
  const buttonRow: React.CSSProperties = {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  };
  const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  const modalContent = (
    <div style={overlay}>
      <div style={container}>
        <h2 style={header}>Generate Lesson</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.pptx"
            onChange={handleFileChange}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <div style={buttonRow}>
            <button
              type="button"
              onClick={onClose}
              style={btnStyle}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={btnStyle}
            >
              {isLoading ? 'Generating...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render into #modal-root portal
  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('modal-root') as HTMLElement
  );
};

export default GenerateLessonModal;
