'use client';

import React, { useState, useCallback, useEffect, ChangeEvent } from 'react';
import { X } from 'lucide-react';

/**
 * LessonModal.tsx
 *
 * Responsibilities:
 *  - Provide a modal interface for users to create a lesson.
 *  - Allow users to enter a lesson prompt (topics to focus on).
 *  - Optionally allow users to upload one or more files.
 *  - On submission, determine if files were uploaded; if yes, call the file-based lesson generation,
 *    preserving the prompt; if not, call the manual lesson prompt handler.
 *
 * This component is triggered by the Generate Lesson button in ResourcePanel.tsx
 * and is rendered using the modal-root pattern established in AppLayout.tsx.
 */

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LessonModal: React.FC<LessonModalProps> = ({ isOpen, onClose }) => {
  // State for the lesson prompt input
  const [lessonPrompt, setLessonPrompt] = useState<string>('');
  // State for the uploaded files (if any)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  // Loading and error state for submission
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the modal state when it is opened
  useEffect(() => {
    if (isOpen) {
      setLessonPrompt('');
      setUploadedFiles([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handler for file input change: converts FileList to an array of Files
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadedFiles(filesArray);
    }
  };

  // Main handler for when the Generate button is clicked
  const handleGenerate = useCallback(async () => {
    if (!lessonPrompt.trim()) {
      setError('Please enter a lesson prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      if (uploadedFiles.length > 0) {
        // Case 1: Files are uploaded.
        // Call the file-based lesson generation process, preserving the user prompt.
        await submitFilesForLesson(lessonPrompt, uploadedFiles);
      } else {
        // Case 2: No files are uploaded.
        // Call the manual lesson prompt handler.
        await submitLessonPrompt(lessonPrompt);
      }
      setIsLoading(false);
      onClose();
    } catch (err) {
      console.error('[LessonModal] Error generating lesson:', err);
      setError('Failed to generate lesson. Please try again later.');
      setIsLoading(false);
    }
  }, [lessonPrompt, uploadedFiles, onClose]);

  // Production-ready implementations should replace these stub functions with
  // actual integrations.

  // Submits files and the prompt for lesson generation using the file upload pipeline.
  async function submitFilesForLesson(prompt: string, files: File[]): Promise<void> {
    // Production code: This should send a request to the backend,
    // including the prompt and the files (e.g., via FormData),
    // to trigger the generate lesson pipeline.
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Submits only the prompt for manual lesson generation using the new handleLessonPrompt handler.
  async function submitLessonPrompt(prompt: string): Promise<void> {
    // Production code: This should call the handleLessonPrompt endpoint,
    // passing the prompt (and additional context from getTextContext if available).
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Do not render the modal if it is not open.
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed background overlay */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={() => {
          if (!isLoading) {
            onClose();
          }
        }}
      ></div>

      {/* Modal container */}
      <div className="relative bg-white w-[500px] max-w-full rounded shadow-lg p-6 z-10 max-h-[85vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Generate Lesson</h2>
          <button
            onClick={() => {
              if (!isLoading) {
                onClose();
              }
            }}
            className="text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-600 mb-4">
          Enter the lesson prompt (topics you want the lesson to focus on) and optionally upload files.
          If files are uploaded, they will be processed along with your prompt.
        </p>

        {/* Lesson Prompt Input */}
        <div className="mb-4">
          <label htmlFor="lessonPrompt" className="block text-sm font-medium text-gray-700 mb-1">
            Lesson Prompt:
          </label>
          <textarea
            id="lessonPrompt"
            className="w-full border border-gray-300 rounded p-2 text-sm resize-vertical min-h-[80px]"
            value={lessonPrompt}
            onChange={(e) => setLessonPrompt(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* File Upload Section */}
        <div className="mb-4">
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 mb-1">
            Upload Files (optional):
          </label>
          <input
            id="fileUpload"
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={isLoading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
          />
          {uploadedFiles.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600">
              {uploadedFiles.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Error Message */}
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (!isLoading) {
                onClose();
              }
            }}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonModal;
