// src/components/modals/onboarding-modal.tsx

/***************************************************************************************
 * @file onboarding-modal.tsx
 * @description
 * This component implements a reusable "Onboarding Modal" designed to provide "Just-in-Time"
 * learning for complex application features. It follows the "Warm Academic" brand aesthetic
 * utilizing Crimson Text for headers and Inter for body text within a Light Almond/White
 * theme.
 *
 * Responsibilities:
 * 1. Render a modal overlay with z-index management.
 * 2. Display dynamic content based on the provided `TutorialContent` data object.
 * 3. Render steps in a vertical layout, interleaving text instructions with relevant screenshots.
 * 4. centralized the `TUTORIAL_DATA` dictionary which maps feature keys to their specific
 * text and image assets.
 ***************************************************************************************/

import React from 'react';
import { X } from 'lucide-react';
import './onboarding-modal.css';
import Image from 'next/image';
/**
 * @interface TutorialStep
 * @description Defines the structure of a single step in the onboarding process.
 * Contains a title, description, and an optional image path to illustrate the step.
 */
export interface TutorialStep {
  stepNumber: number;
  title: string;
  description: string;
  imagePath?: string; // Optional: Some steps might not need a screenshot
}

/**
 * @interface TutorialContent
 * @description Defines the complete data structure for a specific feature's tutorial.
 */
export interface TutorialContent {
  key: string;
  modalTitle: string;
  steps: TutorialStep[];
}

/**
 * @constant TUTORIAL_DATA
 * @description Centralized dictionary containing the static content for all onboarding flows.
 * Keys correspond to the specific feature actions triggered from the Homescreen.
 */
export const TUTORIAL_DATA: Record<string, TutorialContent> = {
  generate_lesson: {
    key: 'generate_lesson',
    modalTitle: 'Generate a Lesson',
    steps: [
      {
        stepNumber: 1,
        title: 'Generating a lesson',
        description: 'Click the "Generate Lesson" button on your dashboard to open the AI tool.',
        imagePath: '/get-started/generate-lesson-menu-item.png',
      },
      {
        stepNumber: 2,
        title: 'Select Study Material',
        description: 'Choose a file (PDF, DOCX, or PPTX) from your library that you want to create a lesson from',
      },
    ],
  },
  study_group: {
    key: 'study_group',
    modalTitle: 'Starting a Study Group',
    steps: [
      {
        stepNumber: 1,
        title: 'Inviting peers',
        description: 'Click the share button in the top menu bar.',
        imagePath: '/get-started/share-collab-scene-1.png',
      },
      {
        stepNumber: 2,
        title: 'Access controls',
        description: 'Select the access control level you want for your notebook and then share the given link with your peers',
        imagePath: '/get-started/share-collab-2.png',
      },
    ],
  },
  uploads: {
    key: 'uploads',
    modalTitle: 'Upload & View Documents',
    steps: [
      {
        stepNumber: 1,
        title: 'Uploading your study material',
        description: 'Navigate to the sidebar and click "Upload files" to open the file manager. Supported file types are pdfs, pptx and docx ',
        imagePath: '/get-started/uploads-scene-1.png',
      },
      {
        stepNumber: 2,
        title: 'Select & View',
        description: 'Once uploaded, click the filename in the navigation panel to open it in the document viewer.',
        imagePath: '/get-started/uploads-scene-2.png',
      },
    ],
  },
  ai_tutor: {
    key: 'ai_tutor',
    modalTitle: 'Chat with AI Tutor',
    steps: [
      {
        stepNumber: 1,
        title: 'Open AI Assistant',
        description: 'Access the AI tutor from the sidebar or within the slideshow interface for instant help.',
        imagePath: '/get-started/ai-tool-ask-ai-feature.png',
      },
    ],
  },
  study_planner: {
    key: 'study_planner',
    modalTitle: 'Create a Study Planner',
    steps: [
      {
        stepNumber: 1,
        title: 'Open Calendar',
        description: 'Click the calendar launcher on the homescreen or top menu bar and select the notebooks you want to create a study plan for.',
        imagePath: '/get-started/calendar-planner-scene-1.png',
      },
      {
        stepNumber: 2,
        title: 'Schedule Sessions',
        description: 'Click a study block from your planner to instantly start a study session or revision on its topics',
        imagePath: '/get-started/calendar-planner-scene-2.png',
      },
    ],
  },
};

interface OnboardingModalProps {
  isOpen: boolean;
  content: TutorialContent | null;
  onClose: () => void;
  onComplete: () => void; // Callback to trigger the actual action after reading
}

/**
 * @function OnboardingModal
 * @description The main presentational component for the onboarding flow.
 */
const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  content,
  onClose,
  onComplete,
}) => {
  // 1. Return null if modal is closed or no content is provided
  if (!isOpen || !content) return null;

  // 2. Main Render: Modal Overlay and Container
  return (
    <div className="onboarding-modal-overlay" onClick={onClose}>
      <div 
        className="onboarding-modal-container"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        
        {/* 3. Header Section */}
        <div className="onboarding-modal-header">
          <h2 className="onboarding-modal-title">{content.modalTitle}</h2>
          <button className="onboarding-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={24} />
          </button>
        </div>

        {/* 4. Scrollable Body Section */}
        <div className="onboarding-modal-body">
          {content.steps.map((step) => (
            <div key={step.stepNumber} className="onboarding-step-container">
              
              {/* Step Header: Badge + Title + Description */}
              <div className="onboarding-step-header">
                <div className="onboarding-step-badge">{step.stepNumber}</div>
                <div className="onboarding-step-text">
                  <h3 className="onboarding-step-title">{step.title}</h3>
                  <p className="onboarding-step-desc">{step.description}</p>
                </div>
              </div>

              {/* Step Image: Render only if path is provided */}
              {step.imagePath && (
                <div className="onboarding-step-image-wrapper">
                  <Image 
                   src={step.imagePath} 
                   alt={`Step ${step.stepNumber}: ${step.title}`}
                   className="onboarding-step-image"
                  priority={step.stepNumber === 1} // Optional: Load the first image immediately for speed
                />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 5. Footer Section */}
        <div className="onboarding-modal-footer">
          <button className="onboarding-action-btn" onClick={onComplete}>
            Start Exploring
          </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingModal;