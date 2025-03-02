// PDFRenderer.tsx
import React from 'react';
import PdfViewer from './PdfViewer';

export interface PdfRendererRef {
  handlePrev: () => void;
  handleNext: () => void;
}

interface PDFRendererProps {
  fileUrl: string | null;
  pdfViewerRef?: React.MutableRefObject<PdfRendererRef | null>;
  onPageChange?: (current: number, total: number) => void;
  // Add scale for PDF zoom
  scale?: number;
}

export const PDFRenderer: React.FC<PDFRendererProps> = ({
  fileUrl,
  pdfViewerRef,
  onPageChange,
  scale = 1.0,
}) => {
  if (!fileUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No document selected. Please select an uploaded note.
      </div>
    );
  }

  return (
    <div className="h-full">
      <PdfViewer
        fileUrl={fileUrl}
        pdfViewerRef={pdfViewerRef}
        onPageChange={onPageChange}
        scale={scale}
      />
    </div>
  );
};
