// app/workspace/(studygraph)/components/layout/ReviewModal/PracticeTab.tsx

/**
 * @file PracticeTab.tsx
 * @description
 *   This component renders the “Practice” view of the Review modal and faithfully preserves
 *   the original review choices: Interleaved Review and Unit Review. It also exposes a small
 *   performance button on the Interleaved card to transition into the Performance view. The
 *   tab does not create its own scroll container; spacing is controlled by
 *   ReviewModalSystem.css so buttons rest at the visual bottom of the dialog when space is
 *   available and participate in scrolling when content overflows.
 */

import React, { useState } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import { TrendingUp } from 'lucide-react';

export interface PracticeTabProps {
  onSelectInterleaved: () => void;
  onSelectUnit: () => void;
  onCancel: () => void;
  onViewPerformance: () => void;
}

type Choice = 'interleaved' | 'unit' | null;

/**
 * handleStart
 * @description
 *   Dispatches the appropriate callback based on the user’s selection, with a concise log
 *   for observability. This function ensures only a single intent is fired and keeps the
 *   surface compatible with the original modal behavior.
 */
const PracticeTab: React.FC<PracticeTabProps> = ({
  onSelectInterleaved,
  onSelectUnit,
  onCancel,
  onViewPerformance,
}) => {
  const [choice, setChoice] = useState<Choice>(null);

  const handleStart = () => {
    if (choice === 'interleaved') {
      console.log('[PracticeTab.tsx][7131] start -> interleaved');
      onSelectInterleaved();
    } else if (choice === 'unit') {
      console.log('[PracticeTab.tsx][7132] start -> unit');
      onSelectUnit();
    }
  };

  return (
    <div>
      <h3 className="modal-text rms-section-title">Choose Review Style</h3>

      {/* Interleaved Review */}
      <div
        className={`radio-option ${choice === 'interleaved' ? 'selected' : ''}`}
        style={{ marginBottom: 16, display: 'block', padding: 12 }}
        role="button"
        tabIndex={0}
        onClick={() => {
          setChoice('interleaved');
          console.log('[PracticeTab.tsx][7133] selected=interleaved');
        }}
        onKeyDown={(e) => e.key === 'Enter' && setChoice('interleaved')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="radio-label">Interleaved Review</span>
          <button
            type="button"
            aria-label="View performance"
            title="View Performance"
            onClick={(e) => {
              e.stopPropagation();
              console.log('[PracticeTab.tsx][7134] performance icon clicked');
              onViewPerformance();
            }}
            className="rms-close"
          >
            <TrendingUp size={16} />
          </button>
        </div>
        <div className="modal-subtext" style={{ textAlign: 'left', margin: '8px 0 0 0' }}>
          Mixes lessons; builds durable recall through spaced practice.
        </div>
      </div>

      {/* Unit Review */}
      <div
        className={`radio-option ${choice === 'unit' ? 'selected' : ''}`}
        style={{ display: 'block', padding: 12 }}
        role="button"
        tabIndex={0}
        onClick={() => {
          setChoice('unit');
          console.log('[PracticeTab.tsx][7135] selected=unit');
        }}
        onKeyDown={(e) => e.key === 'Enter' && setChoice('unit')}
      >
        <span className="radio-label">Unit Review</span>
        <div className="modal-subtext" style={{ textAlign: 'left', margin: '8px 0 0 0' }}>
          Stays in this lesson; ideal for first learning and gap checks.
        </div>
      </div>

      {/* Footer actions */}
      <div className="button-section" style={{ gap: 16, marginTop: 24 }}>
        <button className="btn btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`btn ${choice ? 'btn-primary' : 'btn-disabled'}`}
          onClick={handleStart}
          disabled={!choice}
        >
          Start Review
        </button>
      </div>
    </div>
  );
};

export default PracticeTab;
