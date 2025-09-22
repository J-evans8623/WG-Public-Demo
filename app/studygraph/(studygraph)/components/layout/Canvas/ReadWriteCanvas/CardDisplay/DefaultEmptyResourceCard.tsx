/**
 * @file bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/DefaultEmptyResourceCard.tsx
 * @description
 *  DefaultEmptyResourceCard restores the original, branded empty-state experience for the right-rail
 *  “Notes & Resources” panel. When there are no resources to display, this component renders a clean,
 *  full-bleed slide using the same DOM/CSS hooks as actual resource cards: `resource-display`,
 *  `preview-slide`, and `fixed-height`. It includes the standard slide header, centered body copy that
 *  guides users to select a concept node and add content, and the footer with the concept label area
 *  to preserve visual rhythm. The component is intentionally minimal: no buttons, no capability checks,
 *  no subscriptions, and no side effects. It performs O(1) work and emits a single targeted console log
 *  to confirm that the empty-state rendering path executed for observability and triage.
 */

import React from 'react';
import BaseResourceCard from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/BaseResourceCard';

/**
 * DefaultEmptyResourceCard
 * Responsibility: Render a branded, static empty-state slide that matches the visual structure of
 * real resource cards (header/body/footer). It intentionally provides no interactive CTAs and is
 * viewer-safe by design. This keeps the experience consistent with legacy behavior and ensures
 * pixel-parity, spacing, and tests remain stable without introducing additional logic or state.
 */
const DefaultEmptyResourceCard: React.FC = () => {
  console.log('[DefaultEmptyResourceCard.tsx][8412] render simple empty-state card');

  return (
    <BaseResourceCard className="resource-display preview-slide fixed-height" tabIndex={-1}>
      {/* 1) Header: standard slide header to match other cards */}
      <div className="preview-slide-header">
        <div className="preview-slide-title">Adding your first card</div>
        <div className="preview-slide-actions">{/* empty for layout parity */}</div>
      </div>

      {/* 2) Body: centered, concise onboarding text (no buttons or CTAs) */}
      <div className="preview-slide-body">
        <div
          className="preview-slide-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#6b7280', // text-gray-500
            fontSize: '0.875rem', // text-sm
            padding: '2rem',
          }}
        >
          Select a concept node and click “Add card” to get started.
        </div>
      </div>

      {/* 3) Footer: standard footer to preserve spacing and rhythm */}
      <div className="preview-slide-footer">
        <span className="concept-node-label">Getting Started</span>
        <span className="slide-number" />
      </div>
    </BaseResourceCard>
  );
};

export default DefaultEmptyResourceCard;
