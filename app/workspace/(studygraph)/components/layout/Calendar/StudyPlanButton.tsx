/**
 * @file StudyPlanButton.tsx
 * @description
 * This file implements the primary Call-to-Action (CTA) for the Study Planner within 
 * the lesson reading workflow.
 * * update - 1: Refactored to blend into the SlideShowOverlay environment. I have removed 
 * the fixed prototype sizing and custom shadow in favor of the legacy .slideshow-header-btn 
 * class tokens. The color theme has been adjusted to harmonize with the existing brand 
 * palette, while the "Border Color Wave" animation is maintained as a periodic eye-catcher.
 *
 * Responsibilities:
 * 1) Render the Study Planner CTA with periodic animation.
 * 2) Align visually with the slideshow footer's interactive action cluster.
 * 3) Provide a seamless entry point for untracked notebook integration.
 *
 * Complexity:
 * O(1) presentation logic.
 */

import React from 'react';
import { Plus } from 'lucide-react';

interface StudyPlanButtonProps {
  /** Callback function to handle the button click and trigger transition logic */
  onClick: () => void;
  /** Optional class name for layout adjustments in different parent containers */
  className?: string;
}

/**
 * @function StudyPlanButton
 * @description
 * Renders a theme-aligned animated button for untracked notebook integration.
 * It utilizes the legacy slideshow class tokens to ensure size and typography parity 
 * with the 'Discuss' and 'Ask AI' buttons while using a scoped <style> tag to 
 * drive the discoverability animation.
 */
const StudyPlanButton: React.FC<StudyPlanButtonProps> = ({ onClick, className = "" }) => {
  // 1. Step 1: Apply the shared .slideshow-header-btn class to match existing button geometry
  // 2. Step 2: Use a custom .study-plan-btn-blend class to attach the animation logic
  // 3. Step 3: Implement the 8-second interval 'borderWave' animation using brand-safe blue hues
  return (
    <>
      <button 
        className={`slideshow-header-btn study-plan-btn-blend ${className}`}
        onClick={onClick}
        type="button"
        title="Add this notebook to your study plan"
      >
        <Plus size={14} />
        <span>Study Planner</span>
      </button>

      {/* 4. Step 4: Include refined keyframe animation that cycles every 8 seconds */}
      <style jsx>{`
        .study-plan-btn-blend {
          background: white;
          color: #2C3E50;
          border: 1px solid #D4C4B0;
          position: relative;
          transition: all 0.3s ease;
        }

        .study-plan-btn-blend:hover {
          background: #FAF8F5;
          border-color: #6C8EBF
          color: #6C8EBF;
        }

        @keyframes borderWave {
          0% {
            border-color: #D4C4B0;
            box-shadow: 0 0 0 0 rgba(108, 142, 191, 0);
          }
          10% {
            border-color: #6C8EBF; /* Match the .ai-btn brand blue */
            box-shadow: 0 0 8px 1px rgba(108, 142, 191, 0.4);
          }
          20% {
            border-color: #D4C4B0;
            box-shadow: 0 0 0 0 rgba(108, 142, 191, 0);
          }
          100% {
            border-color: #D4C4B0;
            box-shadow: 0 0 0 0 rgba(108, 142, 191, 0);
          }
        }

        .study-plan-btn-blend {
          animation: borderWave 8s linear infinite;
        }
      `}</style>
    </>
  );
};

export default StudyPlanButton;