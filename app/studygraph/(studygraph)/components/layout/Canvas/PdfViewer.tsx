/**
 * @file PdfViewer.tsx
 * @description
 *   This file contains the production-ready PdfViewer React component.
 *   It is responsible for loading, rendering, and providing navigation for PDF files
 *   using pdfjs-dist. The component includes robust error handling that distinguishes
 *   between permanent errors (404 - resource not found) and transient server errors (500/503),
 *   implementing a retry mechanism for transient failures.
 *
 *   Responsibilities:
 *     - Load PDF files from a provided URL.
 *     - Check HTTP response status codes:
 *         • Fail fast on a 404 (Not Found) error.
 *         • Retry on transient errors (e.g., 500 Internal Server Error) up to a maximum count.
 *     - Render PDF pages on a canvas and overlay an invisible, selectable text layer.
 *     - Expose navigation methods (previous/next page) via a ref for external control.
 *
 * @author  
 * @date    
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';

// Set the worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';

export interface PdfViewerRefType {
  handlePrev: () => void;
  handleNext: () => void;
}

interface PdfViewerProps {
  fileUrl: string;
  scale?: number;
  pdfViewerRef?: React.MutableRefObject<PdfViewerRefType | null>;
  onPageChange?: (current: number, total: number) => void;
}

// Maximum number of retry attempts for transient errors
const MAX_RETRIES = 3;

const PdfViewer: React.FC<PdfViewerProps> = ({
  fileUrl,
  scale = 1.0,
  pdfViewerRef,
  onPageChange,
}) => {
  // Access PDF caching functions from ViewSwitch context
  const { cachePdf, getCachedPdf } = useViewSwitch();

  // State variables for PDF document, page info, loading/error states, and retry counter
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs for canvas and text layer elements
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  /**
   * loadPdf
   * @description
   *   Loads a PDF from the provided fileUrl with robust error handling.
   *   Distinguishes between permanent errors (404) and transient errors (500/503)
   *   to determine whether to retry loading the PDF.
   */
  const loadPdf = useCallback(async () => {
    // Step 1: If the user is offline, immediately set an error and exit.
    if (!navigator.onLine) {
      setError('No internet connection');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 2: Use a cached PDF if available to avoid redundant fetches.
      const cached = getCachedPdf(fileUrl);
      if (cached) {
        setPdfDoc(cached);
        setNumPages(cached.numPages);
        setCurrentPage(1);
        return;
      }

      // Step 3: Fetch the PDF file from the provided URL.
      const response = await fetch(fileUrl);

      // Step 4: Check HTTP status codes:
      //  - If 404: resource is missing; no need to retry.
      //  - Otherwise if not ok (e.g., 500/503): throw an error to trigger a retry.
      if (response.status === 404) {
        throw new Error('File not found (404).');
      } else if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }

      // Step 5: Convert the response to an ArrayBuffer and load the PDF document.
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      // Cache the loaded PDF for future access.
      cachePdf(fileUrl, pdf);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      // Step 6: For transient errors (non-404) and if we haven't exceeded the maximum retries, retry loading.
      if (retryCount < MAX_RETRIES && navigator.onLine && !err.message.includes('404')) {
        setRetryCount(retryCount + 1);
        // Optional delay before retrying
        setTimeout(() => loadPdf(), 1000);
      } else {
        // If maximum retries have been reached or error is permanent, set the error message.
        setError(err.message || 'Error loading PDF');
      }
    } finally {
      setLoading(false);
    }
  }, [fileUrl, retryCount, getCachedPdf, cachePdf]);

  /**
   * renderPage
   * @description
   *   Renders the specified page of the loaded PDF onto the canvas and overlays
   *   a transparent text layer for selectable text.
   * @param pageNum - The page number to render.
   */
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;

    try {
      // Step 1: Retrieve the specified page and determine its viewport based on scale.
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;

      // Step 2: Clear previous content and adjust dimensions.
      textLayer.innerHTML = '';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.left = canvas.offsetLeft + 'px';
      textLayer.style.top = canvas.offsetTop + 'px';
      textLayer.style.position = 'absolute';

      // Step 3: Render the page content on the canvas.
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context!, viewport }).promise;

      // Step 4: Overlay the text layer for selectable text.
      const textContent = await page.getTextContent();
      textContent.items.forEach((item: any) => {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const style = textContent.styles[item.fontName];

        // Create a span element representing each text item.
        const textDiv = document.createElement('span');
        textDiv.textContent = item.str;
        textDiv.style.position = 'absolute';
        textDiv.style.left = `${tx[4]}px`;
        textDiv.style.top = `${tx[5] - fontHeight}px`;
        textDiv.style.fontSize = `${fontHeight}px`;
        textDiv.style.fontFamily = style?.fontFamily || 'sans-serif';
        textDiv.style.pointerEvents = 'all';
        textDiv.style.cursor = 'text';
        textDiv.style.color = 'transparent'; // Invisible text that remains selectable

        // Append the text item to the overlay layer.
        textLayer.appendChild(textDiv);
      });
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Error rendering page');
    }
  }, [pdfDoc, scale]);

  // Side effect: Load PDF when the fileUrl changes or on initial mount.
  useEffect(() => {
    setRetryCount(0);
    loadPdf();
  }, [fileUrl, loadPdf]);

  // Side effect: Re-render the current page whenever the PDF document, page number, or scale changes.
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, renderPage]);

  // Side effect: Notify the parent component of page changes.
  useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage, numPages);
    }
  }, [currentPage, numPages, onPageChange]);

  /**
   * handlePrev
   * @description
   *   Navigates to the previous page of the PDF.
   */
  const handlePrev = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  /**
   * handleNext
   * @description
   *   Navigates to the next page of the PDF.
   */
  const handleNext = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, numPages));
  }, [numPages]);

  // Expose navigation methods via pdfViewerRef for external controls (e.g., toolbar buttons).
  useEffect(() => {
    if (pdfViewerRef) {
      pdfViewerRef.current = { handlePrev, handleNext };
    }
  }, [pdfViewerRef, handlePrev, handleNext]);

  // Render UI based on loading or error state.
  if (loading) {
    return <div className="text-gray-500">Loading PDF...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div
      className="pdf-viewer flex flex-col items-center justify-center min-h-full py-10"
      style={{ backgroundColor: 'var(--right-pane-bg)' }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid #ccc',
            margin: '0 auto',
          }}
        />
        <div
          ref={textLayerRef}
          className="textLayer"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            opacity: 1,
            lineHeight: 1.0,
            zIndex: 1,
            userSelect: 'text',
            MozUserSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        />
      </div>
    </div>
  );
};

export default PdfViewer;
