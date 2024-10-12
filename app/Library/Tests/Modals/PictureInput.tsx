//bloom-maps\app\Library\Tests\Modals\PictureInput.tsx
import React from 'react';
import { Input, Upload, Button } from 'antd';

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
  handlePictureUpload
}) => {

  const validImageTypes = [
    'image/jpeg',  'image/png',  'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff'
  ];

  const beforeUpload = (file: File) => {
    if (validImageTypes.includes(file.type)) {
      handlePictureUpload(file);
    } else {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, SVG, BMP, or TIFF).');
    }
    return false;
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
      {uploadedPicture && <p>Selected File: {uploadedPicture.name}</p>}
      <Input.TextArea
        placeholder="Optional Description"
        value={pictureDescription}
        onChange={(e) => setPictureDescription(e.target.value)}
        rows={4}
      />
    </>
  );
};

export default PictureInput;
