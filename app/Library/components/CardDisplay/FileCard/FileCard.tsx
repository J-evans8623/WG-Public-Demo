// components/FileCard.tsx
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import React from 'react';
import { FaFile, FaFilePdf, FaFileWord, FaFileAlt } from 'react-icons/fa';

interface FileCardProps {
  file: TextFileMessage;
  onOpenFullSize: () => void;
  onDismiss?: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onOpenFullSize, onDismiss }) => {
  // Function to get appropriate icon based on file type
  const getFileIcon = () => {
    switch (file.type) {
      case 'pdf':
        return <FaFilePdf className="w-12 h-12" />;
      case 'doc':
      case 'docx':
        return <FaFileWord className="w-12 h-12" />;
      case 'txt':
        return <FaFileAlt className="w-12 h-12" />;
      default:
        return <FaFile className="w-12 h-12" />;
    }
  };

  return (
    <div className="card card-file" onClick={onOpenFullSize}>
      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
          title="Dismiss"
        >
          ×
        </button>
      )}

      {/* Title */}
      <div className="text-lg font-bold text-center mb-2">{file.title}</div>

      {/* Center the icon */}
      <div className="flex-grow flex items-center justify-center">
        {getFileIcon()}
      </div>

      {/* File info */}
      <div className="text-gray-500 mt-2 text-center">
        <p>{file.type.toUpperCase()} - {(file.size / 1024).toFixed(1)} KB</p>
        <p className="text-sm">{new Date(file.uploadDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default FileCard;