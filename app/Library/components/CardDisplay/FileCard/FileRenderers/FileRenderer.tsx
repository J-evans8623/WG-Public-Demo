// FileRenderer.tsx
import React from 'react';
import { PDFRenderer } from './PDFRenderer';
import { DocRenderer } from './DocRenderer';
import { TextRenderer } from './TextRenderer';

interface FileRendererComponentProps {
  fileType: 'pdf' | 'docx' | 'txt';
  fileContent: string;
  serverUrl: string;
  onError: (error: Error) => void;
  scale?: number;
}

export const FileRenderer: React.FC<FileRendererComponentProps> = ({ 
  fileType, 
  fileContent,
  serverUrl, 
  onError,
  scale = 1.2 
}) => {
  switch (fileType) {
    case 'pdf':
      return (
        <PDFRenderer 
          fileUrl={fileContent} 
          onError={onError} 
          scale={scale} 
        />
      );
    case 'docx':
      return (
        <DocRenderer 
          fileUrl={serverUrl}
          onError={onError} 
          scale={scale}
        />
      );
    case 'txt':
      return (
        <TextRenderer 
          textContent={fileContent} 
          onError={onError} 
        />
      );
    default:
      return <div>Unsupported file type</div>;
  }
};

export default FileRenderer;