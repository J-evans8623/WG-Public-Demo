'use client';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import { FaSearchMinus, FaSearchPlus, FaTimes } from 'react-icons/fa';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { FileRenderer } from './FileRenderers/FileRenderer';
import { mapFileTypeToRenderer } from './fileTypeMapping';
import './FileContent.css';

interface FileContentProps {
  file: TextFileMessage;
  onClose: () => void;
}

const FileContent: React.FC<FileContentProps> = ({ file, onClose }) => {
  const { getFileContent } = useFileAsset();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const fileContent = await getFileContent(file.id);
        setContent(fileContent);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [file.id, getFileContent]);

  const handleError = (error: Error) => {
    setError(error.message);
  };

  const rendererType = mapFileTypeToRenderer(file.type);

  const handleZoomOut = () => {
    if (scale > 0.7) {
      setScale(prev => Math.max(0.7, prev - 0.1));
    }
  };
  
  const handleZoomIn = () => {
    if (scale < 2.0) {
      setScale(prev => Math.min(2.0, prev + 0.1));
    }
  };

  const modalContent = (
    <div className="file-modal-container">
      <div className="file-modal">
        <div className="file-header">
          <h2 className="file-title">{file.title}</h2>
          <div className="toolbar-buttons">
            {scale > 0.7 && (
              <button onClick={handleZoomOut} className="tool-button">
                <FaSearchMinus />
              </button>
            )}
            {scale < 2.0 && (
              <button onClick={handleZoomIn} className="tool-button">
                <FaSearchPlus />
              </button>
            )}
            <button onClick={onClose} className="tool-button close-button">
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="file-content-body">
          {error ? (
            <div className="error-message">{error}</div>
          ) : (
<FileRenderer
  fileType={rendererType}
  fileContent={content}
  serverUrl={file.serverUrl} // Add this line
  onError={handleError}
  scale={scale}
/>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      <div className="file-modal-backdrop" onClick={onClose}></div>
      {modalContent}
    </>,
    document.body
  );
};

export default FileContent;
