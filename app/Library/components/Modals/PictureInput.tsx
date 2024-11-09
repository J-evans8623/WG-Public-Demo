import React, { useState, useEffect } from 'react';
import { Input, Upload, Button } from 'antd';
import { handlePaste } from './pasteImageUtils'; // Import the utility function
import './proposal/picturelayout.css'

interface PictureInputProps {
  pictureTitle: string;
  pictureDescription: string;
  uploadedPicture: File | null;
  setPictureTitle: (title: string) => void;
  setPictureDescription: (description: string) => void;
  handlePictureUpload: (file: File) => void;
}

const PictureInput: React.FC<PictureInputProps> = ({
  pictureTitle,
  pictureDescription,
  uploadedPicture,
  setPictureTitle,
  setPictureDescription,
  handlePictureUpload,
}) => {
  const [pastedImage, setPastedImage] = useState<File | null>(null);  // State to store pasted image
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); // State for image preview

  const validImageTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff',
  ];

  useEffect(() => {
    if (uploadedPicture) {
      const url = URL.createObjectURL(uploadedPicture);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url); // Clean up on unmount or when image changes
    } else {
      setImagePreviewUrl(null);
    }
  }, [uploadedPicture]);

  const beforeUpload = (file: File) => {
    if (validImageTypes.includes(file.type)) {
      handlePictureUpload(file);
      setPastedImage(null);  // Reset pasted image when uploading manually
    } else {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, SVG, BMP, or TIFF).');
    }
    return false;
  };

  const handlePastedImageUpload = (file: File) => {
    handlePictureUpload(file);  // Call existing upload handler
    setPastedImage(file);       // Set pasted image in state
  };

  return (
    <div className="picture-input-modal">
      <div className="input-container">
        <Input
          placeholder="Picture Title"
          value={pictureTitle}
          onChange={(e) => setPictureTitle(e.target.value)}
        />
        <Upload beforeUpload={beforeUpload} showUploadList={false}>
          <Button>Upload Picture</Button>
        </Upload>
      </div>
      {/* Display the preloaded image if available */}
      {imagePreviewUrl ? (
        <div className="picture-preview">
          <img
            src={imagePreviewUrl}
            alt={pictureTitle}
          />
        </div>
      ) : pastedImage ? (
        <p>Pasted Image: {pastedImage.name}</p>
      ) : uploadedPicture ? (
        <p>Selected File: {uploadedPicture.name}</p>
      ) : null}

      <Input.TextArea
        className="picture-description"
        placeholder="Optional Description or Paste Image Here"
        value={pictureDescription}
        onChange={(e) => setPictureDescription(e.target.value)}
        onPaste={(e) => handlePaste(e, validImageTypes, handlePastedImageUpload)}  // Attach the paste handler
        rows={4}
      />
    </div>
  );
};

export default PictureInput;
