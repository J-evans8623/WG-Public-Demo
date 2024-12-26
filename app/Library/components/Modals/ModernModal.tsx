// bloom-maps/app/Library/Tests/Modals/ModernModal.tsx

import React, { useState, useRef } from 'react';
import { Tabs, Button, Input, InputRef } from 'antd';
import CueCardInput from './CueCardInput';
import PictureInput from './PictureInput';
import PracticeSheetInput from './PracticeSheetInput';
import { FaPencilAlt } from 'react-icons/fa';
import './ModalStyles.css';
import './InputStyles.css';
import { Descendant, Node } from 'slate';
import { IQuizQuestion, QuizType } from '../../Definitions/Definitions';

const { TabPane } = Tabs;

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: Descendant[],
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: Descendant[],
    practiceSheetContent?: {
      quizType: 'matching' | 'multipleChoice' | 'wordProblem';
      quizContent: IQuizQuestion[];
    }
  ) => void;
  initialNodeTitle: string;
  mode: 'addChild' | 'addResource' | 'edit';
  initialCueCardTitle?: string;
  initialCueCardContent?: Descendant[];
  initialBloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  initialSource?: string;
  selectedResourceType?: 'cueCard' | 'picture' | 'practiceSheet';
  initialPictureTitle?: string;
  initialPictureDescription?: Descendant[];
  initialPracticeSheetTitle?: string;
  initialPracticeSheetContent?: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem';
    quizContent: IQuizQuestion[];
  };
  initialUploadedPicture?: File | null; // New Prop
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
  initialPracticeSheetContent,
  initialUploadedPicture, // Destructure the new prop
}) => {
  const [nodeTitle, setNodeTitle] = useState(initialNodeTitle || 'New Concept');
  const [cueCardTitle, setCueCardTitle] = useState(initialCueCardTitle || '');
  const [cueCardContent, setCueCardContent] = useState<Descendant[]>(
    initialCueCardContent && initialCueCardContent.length > 0
      ? initialCueCardContent
      : [{ type: 'paragraph', children: [{ text: '' }] }]
  );
  const [bloomLevel, setBloomLevel] = useState(initialBloomLevel || 1);
  const [pictureTitle, setPictureTitle] = useState(initialPictureTitle || '');
  const [uploadedPicture, setUploadedPicture] = useState<File | null>(initialUploadedPicture || null); 
  const [pictureDescription, setPictureDescription] = useState<Descendant[]>(
    initialPictureDescription && initialPictureDescription.length > 0
      ? initialPictureDescription
      : [{ type: 'paragraph', children: [{ text: '' }] }]
  );
  const [practiceSheetTitle, setPracticeSheetTitle] = useState(initialPracticeSheetTitle || '');
  const [practiceContent, setPracticeContent] = useState<{ 
    quizType: QuizType; 
    quizContent: IQuizQuestion[]; 
  }>({
    quizType: 'matching',
    quizContent: initialPracticeSheetContent?.quizContent || [],
  });
  
  const [activeTabKey, setActiveTabKey] = useState<'cueCard' | 'picture' | 'practiceSheet'>(
    selectedResourceType || 'cueCard'
  );
  const [isEditingTitle, setIsEditingTitle] = useState(mode === 'addChild');
  const [source, setSource] = useState('');

  const titleInputRef = useRef<InputRef>(null);
  const handleClose = () => {
    onClose();
  }

  const handleSave = () => {
    const isCueCardTitleEmpty = cueCardTitle.trim() === '';
    const isCueCardContentEmpty = cueCardContent
  .map((node) => Node.string(node).trim())
  .join('') === '';


    if (mode) {
      if (activeTabKey === 'cueCard') {
        if ((isCueCardTitleEmpty && !isCueCardContentEmpty) || (!isCueCardTitleEmpty && isCueCardContentEmpty)) {
          alert('Please fill in both the Cue Card Title and Content, or leave both empty.');
          return;
        }
      }

      switch (activeTabKey) {
        case 'cueCard':
          onSave('cueCard', nodeTitle, cueCardTitle, cueCardContent, bloomLevel, uploadedPicture, initialSource || source);
          break;
        case 'picture':
          if (uploadedPicture) {
            onSave('picture', nodeTitle, pictureTitle,  [{ type: 'paragraph', children: [{ text: '' }] }] , 1, uploadedPicture, source, pictureDescription);
          } else {
            alert('Please upload a picture.');
          }
          break;
        case 'practiceSheet':
          onSave('practiceSheet', nodeTitle, practiceSheetTitle,  [{ type: 'paragraph', children: [{ text: '' }] }] , 1, null, '',  [{ type: 'paragraph', children: [{ text: '' }] }] , practiceContent);
          break;
        default:
          break;
      }
      handleClose();
    }
  };

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
            <h2 className="modal-title">{nodeTitle}</h2>
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
                    source={source} // Pass source
                    setCueCardTitle={setCueCardTitle}
                    setCueCardContent={setCueCardContent}
                    setSource={setSource} // Pass setSource
                  />
              </TabPane>
            )}
            {(selectedResourceType === undefined || selectedResourceType === 'picture') && (
              <TabPane tab="Picture" key="picture">
                <PictureInput
                  pictureTitle={pictureTitle}
                  pictureDescription={pictureDescription}
                  uploadedPicture={uploadedPicture} // Pass the state
                  source={source}
                  setPictureTitle={setPictureTitle}
                  setPictureDescription={setPictureDescription}
                  handlePictureUpload={setUploadedPicture}
                  setSource={setSource}
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
          <Button onClick={handleClose}>Cancel</Button>
        </div>
      </div>
    )
  );
};

export default ModernModal;
