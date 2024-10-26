// bloom-maps\app\Library\Tests\Modals\ModernModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Tabs, Button, Input, InputRef } from 'antd';
import CueCardInput from './CueCardInput';
import PictureInput from './PictureInput';
import PracticeSheetInput from './PracticeSheetInput';
import { FaPencilAlt } from 'react-icons/fa';
import './ModalStyles.css';
import './InputStyles.css';

const { TabPane } = Tabs;

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: string,
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: string,
    practiceSheetContent?: {
      quizType: 'matching' | 'multipleChoice' | 'wordProblem',
      quizContent: string
    }
  ) => void;
  initialNodeTitle: string;
  mode: 'addChild' | 'addResource' | 'editCueCard';
  initialCueCardTitle?: string;
  initialCueCardContent?: string;
  initialBloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  initialSource?: string;
  selectedResourceType?: 'cueCard' | 'picture' | 'practiceSheet';
  initialPictureTitle?: string;
  initialPictureDescription?: string;
  initialPracticeSheetTitle?: string;
  initialPracticeSheetContent?: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem';
    quizContent: string;
};
}

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
  selectedResourceType,
  initialPictureTitle,
  initialPictureDescription,
  initialPracticeSheetTitle,
  initialPracticeSheetContent
}) => {
  const [nodeTitle, setNodeTitle] = useState(initialNodeTitle || 'New Concept');
  const [cueCardTitle, setCueCardTitle] = useState(initialCueCardTitle || '');
  const [cueCardContent, setCueCardContent] = useState(initialCueCardContent || '');
  const [bloomLevel, setBloomLevel] = useState(initialBloomLevel || 1);
  const [pictureTitle, setPictureTitle] = useState('');
  const [uploadedPicture, setUploadedPicture] = useState<File | null>(null);
  const [pictureDescription, setPictureDescription] = useState('');
  const [practiceSheetTitle, setPracticeSheetTitle] = useState('');
  const [practiceContent, setPracticeContent] = useState<{ quizType: "matching" | "multipleChoice" | "wordProblem", quizContent: string }>({ quizType: 'matching', quizContent: initialPracticeSheetContent?.quizContent||'' });
  const [activeTabKey, setActiveTabKey] = useState<'cueCard' | 'picture' | 'practiceSheet'>(
    selectedResourceType || 'cueCard'
  );
  const [isEditingTitle, setIsEditingTitle] = useState(mode === 'addChild');
  const [source, setSource] = useState('');
  
  const titleInputRef = useRef<InputRef>(null);
  const cueCardTitleRef = useRef<InputRef>(null);
  

  const handleSave = () => {
    const isCueCardTitleEmpty = cueCardTitle.trim() === '';
    const isCueCardContentEmpty = cueCardContent.trim() === '';

    // Handle 'addChild' mode - create a new concept node without requiring cue cards
    if (mode === 'addChild') {
      onSave('cueCard', nodeTitle); // Pass only the nodeTitle for creating a new concept
      onClose();
      return;
    }

    if (mode === 'addResource' || mode === 'editCueCard') {
      if (activeTabKey === 'cueCard') {
        if (isCueCardTitleEmpty && isCueCardContentEmpty) {
          alert('Please fill in both the Cue Card Title and Content, or leave both empty.');
          return;
        }
      }

      switch (activeTabKey) {
        case 'cueCard':
          onSave('cueCard', nodeTitle, cueCardTitle, cueCardContent, bloomLevel, uploadedPicture, initialSource);
          break;
        case 'picture':
          if (uploadedPicture) {
            onSave('picture', nodeTitle, pictureTitle, '', 1, uploadedPicture, '', pictureDescription);
          } else {
            alert('Please upload a picture.');
          }
          break;
        case 'practiceSheet':
            onSave('practiceSheet', nodeTitle, practiceSheetTitle, '', 1, null, '', '', practiceContent);
          break;
        default:
          break;
      }
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNodeTitle(initialNodeTitle || 'New Concept');
      setIsEditingTitle(mode === 'addChild');
      setActiveTabKey(selectedResourceType || 'cueCard');
  
      // Clear all fields on new resource addition
      if (mode === 'addResource') {
        setCueCardTitle('');
        setCueCardContent('');
        setBloomLevel(1);
        setPictureTitle('');
        setPictureDescription('');
        setPracticeSheetTitle('');
        setPracticeContent({ quizType: 'matching', quizContent: '' });
      }
  
      // Set initial values for editing based on selectedResourceType
      if (selectedResourceType === 'cueCard') {
        setCueCardTitle(initialCueCardTitle || '');
        setCueCardContent(initialCueCardContent || '');
        setBloomLevel(initialBloomLevel || 1);
        setSource(initialSource || '');
      } else if (selectedResourceType === 'picture') {
        setPictureTitle(initialPictureTitle || '');
        setPictureDescription(initialPictureDescription || '');
      } else if (selectedResourceType === 'practiceSheet' && initialPracticeSheetContent) {
        // Set practice content only if initialPracticeSheetContent is defined
        setPracticeSheetTitle(initialPracticeSheetTitle || '');
        setPracticeContent(initialPracticeSheetContent);
      }
  
      // Focus management
      if (mode === 'addChild') {
        titleInputRef.current?.focus();
      } else {
        cueCardTitleRef.current?.focus();
      }
    }
  }, [
    isOpen,
    initialNodeTitle,
    mode,
    selectedResourceType,
    initialCueCardTitle,
    initialCueCardContent,
    initialBloomLevel,
    initialSource,
    initialPictureTitle,
    initialPictureDescription,
    initialPracticeSheetTitle,
    initialPracticeSheetContent,  // include in dependency array
  ]);
  


  return (
    isOpen && (
      <div className="modal">
        <div className="modal-header">
          {isEditingTitle ? (
            <Input
              ref={titleInputRef}
              placeholder="Node Title"
              value={nodeTitle}
              onChange={(e) => setNodeTitle(e.target.value)}
              className="input"
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
        <div className="modal-content">
          <Tabs activeKey={activeTabKey} onChange={(key) => setActiveTabKey(key as 'cueCard' | 'picture' | 'practiceSheet')}>
            {/* Conditionally render tabs based on `selectedResourceType` */}
            {(selectedResourceType === undefined || selectedResourceType === 'cueCard') && (
              <TabPane tab="Cue Card" key="cueCard">
                <CueCardInput
                  cueCardTitle={cueCardTitle}
                  cueCardContent={cueCardContent}
                  bloomLevel={bloomLevel}
                  setCueCardTitle={setCueCardTitle}
                  setCueCardContent={setCueCardContent}
                  setBloomLevel={setBloomLevel}
                  handlePictureUpload={setUploadedPicture}
                />
              </TabPane>
            )}
            {(selectedResourceType === undefined || selectedResourceType === 'picture') && (
              <TabPane tab="Picture" key="picture">
                <PictureInput
                  pictureTitle={pictureTitle}
                  pictureDescription={pictureDescription}
                  uploadedPicture={uploadedPicture}
                  setPictureTitle={setPictureTitle}
                  setPictureDescription={setPictureDescription}
                  handlePictureUpload={setUploadedPicture}
                />
              </TabPane>
            )}
            {(selectedResourceType === undefined || selectedResourceType === 'practiceSheet') && (
              <TabPane tab="Practice Sheet" key="practiceSheet">
                <PracticeSheetInput
                  practiceSheetTitle={practiceSheetTitle}
                  practiceContent={practiceContent}
                  setPracticeSheetTitle={setPracticeSheetTitle}
                  setPracticeContent={setPracticeContent}
                />
              </TabPane>
            )}
          </Tabs>
        </div>
        <div className="modal-footer">
          <Button onClick={handleSave}>Save</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    )
  );
};

export default ModernModal;
