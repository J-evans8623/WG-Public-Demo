'use client';
// bloom-maps\app\Library\components\ModernModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Tabs, Input, InputRef, Radio, Upload, Button } from 'antd';
import { FaPencilAlt } from 'react-icons/fa';

const { TabPane } = Tabs;
/**
 * Original general purpose modern modal
 * Oct 13/10/2024
 * 
 * 
 */
interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',  // Updated to include resource type
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: string,
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: string,
    practiceSheetContent?: string
  ) => void;
  initialNodeTitle: string;
  mode: 'addChild' | 'addResource' | 'editCueCard'; 
  initialCueCardTitle?: string;
  initialCueCardContent?: string;
  initialBloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  initialSource?: string;
}

const bloomLevelLabels = [
  { level: 1, label: 'Remember' },
  { level: 2, label: 'Understand' },
  { level: 3, label: 'Apply' },
  { level: 4, label: 'Analyze' },
  { level: 5, label: 'Evaluate' },
  { level: 6, label: 'Create' },
];

const ModernModal: React.FC<ModernModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialNodeTitle,
  mode,
  initialCueCardTitle,
  initialCueCardContent,
  initialBloomLevel,
  initialSource,
}) => {
  const [nodeTitle, setNodeTitle] = useState(initialNodeTitle || 'New Concept');
  const [isEditingTitle, setIsEditingTitle] = useState(mode === 'addChild');
  const [cueCardTitle, setCueCardTitle] = useState('');
  const [cueCardContent, setCueCardContent] = useState('');
  const [bloomLevel, setBloomLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [image, setImage] = useState<File | null>(null);
  const [source, setSource] = useState('');

  // New states for Picture and Practice Sheet
  const [pictureTitle, setPictureTitle] = useState('');
  const [uploadedPicture, setUploadedPicture] = useState<File | null>(null);
  const [pictureDescription, setPictureDescription] = useState('');

  const [practiceSheetTitle, setPracticeSheetTitle] = useState('');
  const [practiceContent, setPracticeContent] = useState('');

  const [activeTabKey, setActiveTabKey] = useState<'cueCard' | 'picture' | 'practiceSheet'>('cueCard'); // Track active tab

  const titleInputRef = useRef<InputRef>(null);
  const cueCardTitleRef = useRef<InputRef>(null);
  const cueCardContentRef = useRef<InputRef>(null);

  useEffect(() => {
    if (isOpen) {
      setNodeTitle(initialNodeTitle || 'New Concept');
      setIsEditingTitle(mode === 'addChild');
      setCueCardTitle(mode === 'editCueCard' ? initialCueCardTitle || '' : '');
      setCueCardContent(mode === 'editCueCard' ? initialCueCardContent || '' : '');
      setBloomLevel(mode === 'editCueCard' ? initialBloomLevel || 1 : 1);
      setSource(mode === 'editCueCard' ? initialSource || '' : '');
      setImage(null);

      if (mode === 'addChild') {
        titleInputRef.current?.focus();
      } else {
        cueCardTitleRef.current?.focus();
      }
    }
  }, [isOpen, initialNodeTitle, mode, initialCueCardTitle, initialCueCardContent, initialBloomLevel, initialSource]);


// Handle Picture Upload (for picture tab)
const handlePictureUpload = (file: File) => {
    // List of allowed image MIME types, including more common image formats
    const validImageTypes = [
      'image/jpeg',  // JPEG
      'image/png',   // PNG
      'image/gif',   // GIF
      'image/webp',  // WebP
      'image/svg+xml', // SVG
      'image/bmp',   // BMP
      'image/tiff'   // TIFF
    ];
  
    // Check if the uploaded file is an image based on its MIME type
    if (validImageTypes.includes(file.type)) {
      // Set the uploaded picture since the MIME type matches
      setUploadedPicture(file);
    } else {
      // Notify the user that the file is not a valid image
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, SVG, BMP, or TIFF).');
    }
  
    // Prevent automatic upload by returning false
    return false;
  };
  
  

  // Updated handleSave function to use the activeTabKey state
  const handleSave = () => {
    const isCueCardTitleEmpty = cueCardTitle.trim() === '';
    const isCueCardContentEmpty = cueCardContent.trim() === '';
  
    // Handle 'addChild' mode - create a new concept node without requiring cue cards
    if (mode === 'addChild') {
      onSave('cueCard', nodeTitle); // Pass only the nodeTitle for creating a new concept
      onClose();
      return;
    }
  
    // Generalized logic for adding or editing cue cards, pictures, or practice sheets
    if (mode === 'addResource' || mode === 'editCueCard') {
      // Only validate for cue card titles and content if the cue card tab is active
      if (activeTabKey === 'cueCard') {
        if (isCueCardTitleEmpty && isCueCardContentEmpty) {
          alert('Please fill in both the Cue Card Title and Content, or leave both empty.');
          return;
        }
      }
  
      // Use the tracked active tab key to pass the correct resource type to onSave
      switch (activeTabKey) {
        case 'cueCard':
          onSave('cueCard', nodeTitle, cueCardTitle, cueCardContent, bloomLevel, image, source);
          break;
        case 'picture':
          if (uploadedPicture) {
            onSave('picture', nodeTitle, pictureTitle, '', 1, uploadedPicture, '', pictureDescription);
          } else {
            alert('Please upload a picture.');
          }
          break;
        case 'practiceSheet':
          onSave('practiceSheet', nodeTitle, practiceSheetTitle, practiceContent);
          break;
        default:
          break;
      }
      onClose();
    }
  };

  const getTabContent = (key: string) => {
    switch (key) {
      case 'cueCard':
        return (
          <>
            <Input
              ref={titleInputRef}
              placeholder="Cue Card Title"
              value={cueCardTitle}
              onChange={(e) => setCueCardTitle(e.target.value)}
              style={{ backgroundColor: '#f5f5f5', borderRadius: '4px' }}
            />
            <Input.TextArea
              ref={cueCardContentRef}
              placeholder="Cue Card Content"
              value={cueCardContent}
              onChange={(e) => setCueCardContent(e.target.value)}
              rows={4}
              style={{ backgroundColor: '#f5f5f5', borderRadius: '4px', marginTop: '10px' }}
            />
            <div style={{ marginTop: '10px' }}>
              <label>Bloom’s Taxonomy Level:</label>
              <Radio.Group
                onChange={(e) => setBloomLevel(e.target.value)}
                value={bloomLevel}
                style={{ marginTop: '10px' }}
              >
                {bloomLevelLabels.map(({ level, label }) => (
                  <Radio key={level} value={level}>
                    {label}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
            <Upload beforeUpload={handlePictureUpload} showUploadList={false}>
  <Button>Upload Picture</Button>
</Upload>

          </>
        );
      case 'picture':
        return (
          <>
            <Input
              placeholder="Picture Title"
              value={pictureTitle}
              onChange={(e) => setPictureTitle(e.target.value)}
            />
<Upload beforeUpload={handlePictureUpload} showUploadList={false}>
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
      case 'practiceSheet':
        return (
          <>
            <Input
              placeholder="Practice Sheet Title"
              value={practiceSheetTitle}
              onChange={(e) => setPracticeSheetTitle(e.target.value)}
            />
            <Input.TextArea
              placeholder="Practice Sheet Content"
              value={practiceContent}
              onChange={(e) => setPracticeContent(e.target.value)}
              rows={6}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    isOpen && (
      <div
        className="fixed bottom-[150px] left-1/2 transform -translate-x-1/2 z-50"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <div className="relative bg-gray-100 p-6 rounded shadow-lg w-[600px] border border-gray-300">
          <div className="flex items-center">
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                placeholder="Node Title"
                value={nodeTitle}
                onChange={(e) => setNodeTitle(e.target.value)}
                className="w-full text-lg font-semibold p-2 focus:outline-none bg-gray-200 border border-gray-300 rounded"
              />
            ) : (
              <h2 className="w-full text-lg font-semibold p-2">{nodeTitle}</h2>
            )}
            {mode === 'addResource' && (
              <button
                onClick={() => {
                  setIsEditingTitle(true);
                  titleInputRef.current?.focus();
                }}
                className="ml-2 text-gray-600 hover:text-gray-800"
                title="Edit Title"
              >
                <FaPencilAlt />
              </button>
            )}
          </div>

          <Tabs activeKey={activeTabKey} onChange={(key) => setActiveTabKey(key as 'cueCard' | 'picture' | 'practiceSheet')}>
            <TabPane tab="Cue Card" key="cueCard">
              {getTabContent('cueCard')}
            </TabPane>
            <TabPane tab="Picture" key="picture">
              {getTabContent('picture')}
            </TabPane>
            <TabPane tab="Practice Sheet" key="practiceSheet">
              {getTabContent('practiceSheet')}
            </TabPane>
          </Tabs>

          <div className="mt-4 flex justify-end space-x-2">
            <Button type="primary" onClick={handleSave}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    )
  );
};

export default ModernModal;
