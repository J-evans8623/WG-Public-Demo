// PDFRenderer.tsx

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { PDFRendererProps } from './types';

// Initialize worker only once
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export const PDFRenderer: React.FC<PDFRendererProps> = ({ 
  fileUrl, 
  onError, 
  scale = 1.2 
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  // Handle errors both from document and pages
  const handleError = (err: Error) => {
    setError(err);
    onError(err);
  };

  // Reset error when fileUrl changes
  useEffect(() => {
    setError(null);
  }, [fileUrl]);

  return (
    <div className="pdf-viewer">
      {error ? (
        <div className="pdf-error">Error loading PDF. Please try again.</div>
      ) : (
        <div className="pdf-document">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={handleError}
            loading={<div>Loading PDF...</div>}
          >
            {Array.from(new Array(numPages), (_, index) => (
              <Page 
                key={`page_${index + 1}`}
                pageNumber={index + 1} 
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onRenderError={handleError}
                loading={`Loading page ${index + 1}...`}
              />
            ))}
          </Document>
        </div>
      )}
    </div>
  );
};

/**
 * This simpler implementation works because it has fewer moving parts and state changes. The key difference is that it doesn't try to manage zoom transitions or debounce scale changes - it just directly applies the new scale value when it changes
 * 
 * 
 */