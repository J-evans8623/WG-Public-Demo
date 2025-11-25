// SafeContent.tsx

import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

interface SafeContentProps {
  html: string;
  className?: string;
  onCitationClick?: (index: number) => void;
}

const SafeContent: React.FC<SafeContentProps> = ({
  html,
  className,
  onCitationClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Move configuration into client-only effect
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 3443 SafeContent.tsx: running DOMPurify.setConfig on client
    DOMPurify.setConfig({
      ADD_TAGS: ['sup', 'ul', 'li', 'img'],
      ADD_ATTR: ['class', 'data-cite','src', 'alt', 'title', 'width', 'height'], // Added ima
    });
  }, []);

  // Sanitize once, memoized by input string
  const sanitized = React.useMemo(() => {
    // 3443 SafeContent.tsx: sanitizing HTML
    return DOMPurify.sanitize(html);
  }, [html]);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = sanitized;

    // 3443 SafeContent.tsx: rendering math in element
    renderMathInElement(containerRef.current, {
  delimiters: [
    { left: '\\\\(', right: '\\\\)', display: false }, // match “\\( … \\)”
    { left: '\\(',   right: '\\)',   display: false }, // match “\( … \)”
    { left: '\\\\[', right: '\\\\]', display: true  }, // match “\\[ … \\]”
    { left: '\\[',   right: '\\]',   display: true  }, // match “\[ … \]”
  ],
      throwOnError: true,
    });

    const nodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('sup.citation')
    );
    const listeners: Array<() => void> = [];

    nodes.forEach(el => {
      const handler = (e: MouseEvent) => {
        e.preventDefault();
        const raw = el.getAttribute('data-cite') ?? '';
        const idx = parseInt(raw, 10);
        if (!isNaN(idx) && onCitationClick) {
          onCitationClick(idx);
        }
      };
      el.addEventListener('click', handler);
      listeners.push(() => el.removeEventListener('click', handler));
    });

    const imageNodes = Array.from(containerRef.current.querySelectorAll<HTMLImageElement>('img'))

    imageNodes.forEach(img => {
      // 1. Add responsive styling classes
      img.classList.add('max-w-full', 'h-auto', 'rounded', 'shadow-sm');
      
      // 2. Ensure accessibility
      if (!img.alt) {
        img.alt = 'Image';
      }
      
      // 3. Add loading optimization
      img.loading = 'lazy';
      
      // 4. Handle load errors gracefully
      img.onerror = () => {
        console.error('[SafeContent.tsx][3005] Failed to load image:', img.src);
        img.alt = 'Failed to load image';
        img.classList.add('opacity-50');
      };
    });

    return () => listeners.forEach(fn => fn());
  }, [sanitized, onCitationClick]);

  return <div ref={containerRef} className={className} />;
};

export default SafeContent;
