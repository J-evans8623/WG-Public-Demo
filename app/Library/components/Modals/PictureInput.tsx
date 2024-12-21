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
import Image from 'next/image';
import { PictureOutlined } from '@ant-design/icons'; // For the default icon

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

  const handleDropOrPaste = (e: React.DragEvent | React.ClipboardEvent) => {
    e.preventDefault();
    const files = (e as React.ClipboardEvent).clipboardData?.files || (e as React.DragEvent).dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validImageTypes.includes(file.type)) {
        handlePictureUpload(file);
        setPastedImage(file);
      } else {
        alert('Please upload or paste a valid image file.');
      }
    }
  };

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
  
    <div
      className="image-section"
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        margin: '10px 0',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#f9f9f9',
        cursor: 'pointer',
        height: '75px',
        position: 'relative', // Required for positioning the X button
      }}
      onClick={() => {
        const uploadButton = document.querySelector('.upload-button') as HTMLElement;
        uploadButton?.click();
      }}
      onPaste={(e) => handleDropOrPaste(e)}
      onDrop={(e) => handleDropOrPaste(e)}
      onDragOver={(e) => e.preventDefault()}
    >
      {imagePreviewUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Image
            src={imagePreviewUrl}
            alt={pictureTitle}
            width={80}
            height={80}
            layout="fixed"
          />
          {/* Add the X button */}
          <button
            onClick={() => {
              setImagePreviewUrl(null);
              setPastedImage(null);
            }}
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: 'red',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '15px',
              height: '15px',
              cursor: 'pointer',
              fontSize: '10px',
              lineHeight: '15px',
              textAlign: 'center',
            }}
            title="Remove image"
          >
            &times;
          </button>
        </div>
      ) : (
        <div>
          <PictureOutlined style={{ fontSize: '48px', color: '#ccc' }} />
          <p>Paste or upload an image</p>
        </div>
      )}
    </div>
  
    <div
      className="description-editor"
      style={{
        marginTop: '10px',
        background: '#fff',
        border: '1px solid #ccc',
        padding: '10px',
      }}
    >
      <RichTextEditor
        value={descriptionValue}
        onChange={(newDesc) => setPictureDescription(newDesc)}
        defaultString='Add description for picture'
      />
    </div>
  </div>
  
  );
};

export default PictureInput;

