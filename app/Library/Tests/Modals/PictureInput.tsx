import React, { useState } from 'react';
import { Input, Upload, Button } from 'antd';
import { handlePaste } from './pasteImageUtils'; // Import the utility function

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

  const validImageTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff',
  ];

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
    <>
      <Input
        placeholder="Picture Title"
        value={pictureTitle}
        onChange={(e) => setPictureTitle(e.target.value)}
      />
      <Upload beforeUpload={beforeUpload} showUploadList={false}>
        <Button>Upload Picture</Button>
      </Upload>
      {/* Only display the latest image (pasted or manually uploaded) */}
      {pastedImage ? (
        <p>Pasted Image: {pastedImage.name}</p>
      ) : uploadedPicture ? (
        <p>Selected File: {uploadedPicture.name}</p>
      ) : null}

      <Input.TextArea
        placeholder="Optional Description or Paste Image Here"
        value={pictureDescription}
        onChange={(e) => setPictureDescription(e.target.value)}
        onPaste={(e) => handlePaste(e, validImageTypes, handlePastedImageUpload)}  // Attach the paste handler
        rows={4}
      />
    </>
  );
};

export default PictureInput;
