// src/app/workspace/(studygraph)/components/layout/Cards/BaseResourceCard.tsx

/**
 * @file BaseResourceCard.tsx
 * @description
 *   Soft-border card wrapper that accepts both our custom props and
 *   any native HTML attributes (e.g. onKeyDown, tabIndex).
 *
 *   Responsibilities:
 *   - Provide a light visual container for any inner resource.
 *   - Forward click, class, keyboard, focus, and ARIA attributes to the <article>.
 */

import React from 'react';

/**
 * We extend React.HTMLAttributes<HTMLElement> so that
 * this component can accept onKeyDown, tabIndex, aria-*, etc.
 */
export interface BaseResourceCardProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional click handler (e.g. for flipping cue cards) */
  onClick?: () => void;
  /** Additional Tailwind (or custom) classes */
  className?: string;
  /** Inner content of the card */
  children: React.ReactNode;
}

const BaseResourceCard: React.FC<BaseResourceCardProps> = ({
  onClick,
  className = '',
  children,
  ...restProps  // includes onKeyDown, tabIndex, aria-*, etc.
}) => (
  <article
    onClick={onClick}
    className={`
      relative
      bg-[#F8FBFE]
      border
      border-[rgba(197,211,227,0.6)]   /* 60% opacity */
      rounded-md
      p-6
      shadow-sm hover:shadow
      transition-shadow duration-150
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
    {...restProps}
  >
    {children}
  </article>
);

export default BaseResourceCard;
