// app/studygraph/(studygraph)/components/modals/LoadingOverlayModal.tsx
/**
 * @file LoadingOverlayModal.tsx
 * @description
 * A brand-aligned, full-viewport loading overlay modal that is designed to be mounted through the
 * global modal system and registered via the modal registry. Its core responsibilities are:
 * 1) Render a non-dismissable, accessible overlay (role="dialog", aria-modal="true") that blocks
 *    interaction with underlying content during document-heavy workflows such as selecting an
 *    existing file, creating a new notebook, or opening a shared link.
 * 2) Display a concise title and optional subtitle with a light, pulsing animation to indicate
 *    progress without implying indefinite loading. The component purposely contains no document
 *    or readiness logic; Phase 2’s controller will orchestrate its open/close lifecycle.
 * 3) Support small/large sizing presets, respect existing brand tokens (colors, spacing), and
 *    isolate its CSS in a dedicated file to avoid regressions. The animation and layout avoid
 *    unnecessary reflows for consistent performance in complex screens.
 * 4) Offer focused observability through conservative console logs indicating mount/unmount and
 *    the effective render props, enabling developers to trace modal flows during debugging.
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './LoadingOverlayModal.css';

export type LoadingOverlayVariant = 'default' | 'success' | 'warning';

export interface LoadingOverlayModalProps {
  onClose: () => void;              // Provided by modal manager; not surfaced to users here.
  title: string;                     // Required, bold headline.
  subtitle?: string;                 // Optional single-line or short sentence.
  size?: 'small' | 'large';          // Visual density preset.
  variant?: LoadingOverlayVariant;   // Reserved for future color accents.
}

/**
 * @function LoadingOverlayModal
 * @description
 * Renders a blocking, accessible overlay using a portal to #modal-root. The overlay is not
 * dismissable by user action; the lifecycle is controlled by the modal manager. The function
 * ensures the container exists, logs key lifecycle steps for observability, and renders
 * semantically structured content (title, subtitle, animation) for predictable a11y and UX.
 * Time complexity: O(1) per render; no loops over data or heavy computations are performed.
 */
const LoadingOverlayModal: React.FC<LoadingOverlayModalProps> = ({
  onClose,       // Not used in UI; kept for parity with modal system.
  title,
  subtitle,
  size = 'large',
  variant = 'default',
}) => {
  useEffect(() => {
    console.log('[LoadingOverlayModal.tsx][6201] mounted', { title, subtitle, size, variant });
    return () => {
      console.log('[LoadingOverlayModal.tsx][6202] unmounted');
    };
  }, [title, subtitle, size, variant]);

  const target = typeof document !== 'undefined'
    ? document.getElementById('modal-root')
    : null;

  if (!target) {
    console.warn('[LoadingOverlayModal.tsx][6203] #modal-root not found; rendering skipped');
    return null;
  }

  const sizeClass = size === 'small' ? 'lo-card--sm' : 'lo-card--lg';
  const variantClass = `lo-card--${variant}`;

  const node = (
    <div className="lo-overlay" role="dialog" aria-modal="true" aria-label="Loading">
      <div className={`lo-card ${sizeClass} ${variantClass}`}>
        <div className="lo-anim" aria-hidden="true">
          <span className="lo-dot" />
          <span className="lo-dot" />
          <span className="lo-dot" />
        </div>

        <div className="lo-texts">
          <h2 className="lo-title">{title}</h2>
          {subtitle ? <p className="lo-subtitle">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(node, target);
};

export default LoadingOverlayModal;
