// ===================== PDFRenderer.tsx =====================
/**
 * @file PDFRenderer.tsx
 * @description
 *   Simple wrapper that renders <PdfViewer /> when a fileUrl is provided,
 *   otherwise shows a “no document selected” placeholder.
 *
 * Responsibilities:
 *   - Check for null/undefined fileUrl.
 *   - Forward scale, onPageChange, and ref to PdfViewer.
 */

import React, { forwardRef } from 'react';
import PdfViewer, { PdfViewerRefType } from './PdfViewer';

interface PDFRendererProps {
  fileUrl: string | null;
  scale?: number;
  onPageChange?: (current: number, total: number) => void;
}

const PDFRenderer = forwardRef<PdfViewerRefType, PDFRendererProps>(
  ({ fileUrl, scale = 1.0, onPageChange }, ref) => {
    if (!fileUrl) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          No document selected. Please select an uploaded note.
        </div>
      );
    }
    return (
      <PdfViewer
        ref={ref}
        fileUrl={fileUrl}
        scale={scale}
        onPageChange={onPageChange}
      />
    );
  }
);

PDFRenderer.displayName = 'PDFRenderer';
export default PDFRenderer;
