/**
 * @file app/(marketing)/_components/AudienceSelector.tsx
 * @description
 * Shared audience-switching pill selector, placed in the hero of each landing page.
 *
 * Responsibilities:
 *  - Renders three pill buttons (Student, Lifetime Learner, Educator)
 *  - Derives active state from the `activeAudience` prop passed by each page
 *  - Preserves the original desktop single-row layout
 *  - Uses an intentional mobile-only two-row centered arrangement:
 *      row 1: Student + Lifetime Learner
 *      row 2: Educator centered
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AUDIENCE_BUTTON_LABELS,
  AUDIENCE_ROUTES,
  type AudienceType,
} from '@/app/marketing.config';

type AudienceSelectorProps = {
  activeAudience: AudienceType;
};

const AUDIENCE_ORDER: AudienceType[] = ['students', 'learners', 'educators'];

export default function AudienceSelector({
  activeAudience,
}: AudienceSelectorProps): JSX.Element {
  const router = useRouter();
  const [pulseActive, setPulseActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPulseActive(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (key: AudienceType) => {
    router.push(AUDIENCE_ROUTES[key]);
  };

  return (
    <>
      <style>{`
        @keyframes wg-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(227, 68, 50, 0.45); }
          60%  { box-shadow: 0 0 0 10px rgba(227, 68, 50, 0); }
          100% { box-shadow: 0 0 0 0 rgba(227, 68, 50, 0); }
        }

        .wg-audience-selector {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
          margin-bottom: 24px;
        }

        .wg-audience-selector-label {
          font-family: Inter, sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #b89070;
        }

        .wg-audience-selector-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .wg-audience-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 50px;
          font-family: Inter, sans-serif;
          font-size: 0.88rem;
          cursor: pointer;
          outline: none;
          white-space: nowrap;
          transition:
            background 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease,
            border-color 0.2s ease,
            opacity 0.2s ease;
        }

        .wg-audience-pill:hover {
          transform: translateY(-1px);
        }

        .wg-audience-pill-pulse {
          animation: wg-pulse-ring 0.95s ease 3;
        }

        .wg-audience-pill-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.85);
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .wg-audience-selector {
            align-items: center;
            margin-top: 10px;
            margin-bottom: 18px;
          }

          .wg-audience-selector-label {
            text-align: center;
          }

          .wg-audience-selector-row {
            justify-content: center;
            width: 100%;
          }

          .wg-audience-pill {
            min-width: 0;
            font-size: 0.86rem;
          }

          .wg-audience-pill[data-audience-key=educators] {
            margin-inline: auto;
          }
        }
      `}</style>

      <div className="wg-audience-selector">
        <span className="wg-audience-selector-label">I am a</span>

        <div className="wg-audience-selector-row" role="group" aria-label="Select your audience">
          {AUDIENCE_ORDER.map((key) => {
            const isActive = key === activeAudience;
            const label = AUDIENCE_BUTTON_LABELS[key];

            return (
              <button
                key={key}
                type="button"
                data-audience-key={key}
                className={[
                  'wg-audience-pill',
                  isActive && pulseActive ? 'wg-audience-pill-pulse' : '',
                ].join(' ')}
                onClick={() => handleSelect(key)}
                aria-pressed={isActive}
                style={{
                  background: isActive ? '#E34432' : 'transparent',
                  color: isActive ? '#ffffff' : '#5a3a2a',
                  fontWeight: isActive ? 600 : 400,
                  border: isActive
                    ? '2px solid #E34432'
                    : '2px dashed rgba(227, 68, 50, 0.45)',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  opacity: isActive ? 1 : 0.75,
                }}
              >
                {label}
                {isActive ? <span className="wg-audience-pill-dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}