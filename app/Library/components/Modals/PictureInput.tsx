/**
 * @file PictureInput.tsx
 * @description
 * This file handles inputs for adding or editing a picture resource.
 * It replaces the string-based description input field with a RichTextEditor,
 * allowing rich text formatting for the picture description.
 * 
 * Responsibilities:
 * - Render inputs for picture title (plain string).
 * - Render a RichTextEditor for the picture description (Descendant[]).
 * - Handle picture uploads.
 * 
 * Inputs:
 * - pictureTitle: string
 * - pictureDescription: Descendant[]
 * - uploadedPicture: File | null
 * - setPictureTitle: (title: string) => void
 * - setPictureDescription: (description: Descendant[]) => void
 * - handlePictureUpload: (file: File) => void
 * 
 * Outputs:
 * - Updated title, description, and uploaded picture states in the parent component.
 */

import React, { useState, useEffect } from 'react';
import { Input, Upload, Button } from 'antd';
import { handlePaste } from './pasteImageUtils';
import { Descendant } from 'slate';
import RichTextEditor from './RichTextEditor';

interface PictureInputProps {
  pictureTitle: string;
  pictureDescription: Descendant[];
  uploadedPicture: File | null;
  setPictureTitle: (title: string) => void;
  setPictureDescription: (description: Descendant[]) => void;
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
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const validImageTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff',
  ];

  useEffect(() => {
    if (uploadedPicture) {
      const url = URL.createObjectURL(uploadedPicture);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [uploadedPicture]);

  const beforeUpload = (file: File) => {
    if (validImageTypes.includes(file.type)) {
      handlePictureUpload(file);
      setPastedImage(null);
    } else {
      alert('Please upload a valid image file.');
    }
    return false;
  };

  // Initialize description if empty
  const descriptionValue: Descendant[] = pictureDescription.length > 0 ? pictureDescription : [
    { type: 'paragraph', children: [{ text: '' }] }
  ];

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

      {imagePreviewUrl ? (
        <div className="picture-preview">
          <img src={imagePreviewUrl} alt={pictureTitle} />
        </div>
      ) : pastedImage ? (
        <p>Pasted Image: {pastedImage.name}</p>
      ) : uploadedPicture ? (
        <p>Selected File: {uploadedPicture.name}</p>
      ) : null}

      {/**
       * Replace Input.TextArea with RichTextEditor for pictureDescription.
       * Attach onPaste for image handling if needed (currently for text only).
       */}
      <div className="description-editor" style={{ marginTop: '10px', background: '#fff', border: '1px solid #ccc', padding: '10px' }}
        onPaste={(e) => handlePaste(e, validImageTypes, (file) => { handlePictureUpload(file); setPastedImage(file); })}
      >
        <RichTextEditor
          value={descriptionValue}
          onChange={(newDesc) => setPictureDescription(newDesc)}
        />
      </div>
    </div>
  );
};

export default PictureInput;
