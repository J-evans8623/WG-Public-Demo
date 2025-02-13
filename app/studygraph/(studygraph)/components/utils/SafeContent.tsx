/**
 * @file SafeContent.tsx
 * @description Safely renders HTML content by sanitizing it using DOMPurify.
 *              This helps prevent XSS attacks by cleaning any potentially dangerous HTML.
 *
 * @author 
 * @date 
 */
import React from 'react';
import DOMPurify from 'dompurify';

interface SafeContentProps {
  html: string;
  className?: string;
}

const SafeContent: React.FC<SafeContentProps> = ({ html, className }) => {
  const sanitizedHTML = DOMPurify.sanitize(html);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
};

export default SafeContent;
