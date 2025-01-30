// DocRenderer.tsx
import React, { useRef, useEffect } from 'react';
import { renderAsync } from 'docx-preview';

interface DocRendererProps {
  fileUrl: string;
  onError: (error: Error) => void;
  scale: number;  // Add this
}

export const DocRenderer: React.FC<DocRendererProps> = ({ fileUrl, onError, scale }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDocument = async () => {
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const blob = await response.blob();
        await renderAsync(blob, containerRef.current, containerRef.current, {
          className: 'docx-renderer',
          inWrapper: true,
          useBase64URL: true,
          ignoreFonts: true,
          ignoreHeight: true,
          ignoreWidth: true
        });

        // Remove any unwanted elements
        const unwantedElements = containerRef.current.querySelectorAll('.preview-style, .docx-wrapper > style');
        unwantedElements.forEach(el => el.remove());

        // Apply zoom scale to content
        const contentElements = containerRef.current.querySelectorAll('.docx-wrapper');
        contentElements.forEach(el => {
          (el as HTMLElement).style.transform = `scale(${scale})`;
          (el as HTMLElement).style.transformOrigin = 'top center';
        });

        // Add spacing between pages
        const pages = containerRef.current.querySelectorAll('.docx-wrapper > div');
        pages.forEach((page) => {
          (page as HTMLElement).style.marginBottom = '2rem';
          (page as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          (page as HTMLElement).style.background = 'white';
          (page as HTMLElement).style.padding = '40px';
        });
      } catch (err) {
        console.error('Error rendering document:', err);
        onError(err instanceof Error ? err : new Error('Failed to render document'));
      }
    };

    renderDocument();
  }, [fileUrl, onError, scale]); // Add scale to dependencies

  return (
    <div className="file-content-body" style={{ background: 'white' }}>
      <div className="doc-scroll-container" style={{
        width: '100%',
        height: 'calc(90vh - 120px)',
        overflow: 'auto',
        backgroundColor: 'white',
        padding: '0.5rem'
      }}>
        <div 
          ref={containerRef} 
          className="docx-container"
          style={{
            backgroundColor: 'white',
            width: '100%',
            maxWidth: '850px',
            margin: '10 auto',
            position: 'relative'
          }}
        />
      </div>
    </div>
  );
};

export default DocRenderer;