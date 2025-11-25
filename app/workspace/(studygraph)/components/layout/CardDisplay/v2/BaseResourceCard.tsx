/**
 * @file BaseResourceCard.tsx
 * @description
 *   Soft‐border card wrapper. All visual styling is now handled by the "slide" CSS class.
 *   We simply forward className and any native HTML attributes (e.g. onKeyDown, tabIndex).
 */

import React from 'react';

export interface BaseResourceCardProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional click handler (e.g. for flipping cue cards) */
  onClick?: () => void;
  /** Additional CSS classes (e.g. "slide resource-display") */
  className?: string;
  /** Inner content of the card */
  children: React.ReactNode;
}

const BaseResourceCard: React.FC<BaseResourceCardProps> = ({
  onClick,
  className = '',
  children,
  ...restProps // includes onKeyDown, tabIndex, aria-*, etc.
}) => (
  <article
    onClick={onClick}
    className={`${className}`}
    {...restProps}
  >
    {children}
  </article>
);

export default BaseResourceCard;
