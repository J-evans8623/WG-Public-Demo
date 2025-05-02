/***************************************************************************************
 * @file BaseResourceCard.tsx       (soft-border variant)
 * @description
 *   Card shell with a very light stroke (≈60 % opacity).  Keeps the existing 1 px border
 *   so cards are still clearly outlined, but the visual weight is reduced to let the
 *   main map–notes divider remain the dominant element.
 *
 * Props:
 *   • onClick?   – optional click handler (e.g. CueCard flip)
 *   • className? – additional layout / utility classes
 *   • children   – inner card content
 ***************************************************************************************/

import React from 'react';

export interface BaseResourceCardProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

const BaseResourceCard: React.FC<BaseResourceCardProps> = ({
  onClick,
  className = '',
  children,
}) => (
  <article
    onClick={onClick}
    className={`
      relative
      bg-[#F8FBFE]
      border
      border-[rgba(197,211,227,0.6)]   /* 60 % opacity */
      rounded-md
      p-6
      shadow-sm hover:shadow
      transition-shadow duration-150
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
    {children}
  </article>
);

export default BaseResourceCard;
