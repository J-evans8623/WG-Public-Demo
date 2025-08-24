/**
 * @file ResourceDisplay.tsx
 * @description
 *   Re-usable resource card (read-only in NotesTab, editable in EditTab).
 *
 *   ▸ View-only mode (`isEditing=false`) – unchanged.
 *   ▸ Edit mode (`isEditing=true`) – controlled form driven by `inputData`.
 *       • Topic selector lists existing topics **and** a “Create new topic +” option.
 *       • When the option is chosen, the selector is replaced by a text field for
 *         the new concept-node title.  The decision (existing vs new) is stored in
 *         `inputData.createNode`, `inputData.selectedTopicId`, and `inputData.nodeTitle`.
 *       • The component never mutates resource data directly; it only emits
 *         `onInputDataChange`, `onTitleChange`, and `onContentChange`.
 */

import React, {
  KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Maximize2,
  ChevronsUpDown,
  Check,
  X as CloseIcon,
  PlusCircle,
} from 'lucide-react';
import BaseResourceCard from './Cards/BaseResourceCard';
import ResourceMenu from './ResourceMenu';
import CueCard from './Cards/CueCard';
import NoteCard from './Cards/NoteCard';
import QuizCard from './Cards/QuizCard';
import QuizOverlay from '../../utils/quiz/QuizOverlay';
import RichTextEditor from '@/components/RichTextEditor';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { QuizType, IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from './types/resourceForm';
import './resourceDisplay.css';

export type ResourceType = 'cuecard' | 'note' | 'quiz';

export interface ResourceDisplayProps {
  /* identity */
  id: string;
  nodeId?: string;
  type: ResourceType;

  /* view data */
  ConceptNodeTitle: string;
  title: string;
  content: string | object;
  /* flags */
  isEditing: boolean;
  /** `true` when EditTab is displaying a brand-new draft (enables topic picker) */
  isNewCard?: boolean;

  /* controlled metadata (edit-mode only) */
  inputData?: ResourceFormInput;
  onInputDataChange?: (next: ResourceFormInput) => void;

  /* callbacks */
  onTitleChange: (t: string) => void;
  onContentChange: (c: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onDismiss?: () => void;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  /* identity & display */
  id,
  nodeId,
  type,
  ConceptNodeTitle,
  title,
  content,
  /* flags + controlled state */
  isEditing,
  isNewCard = false,
  inputData,
  onInputDataChange,

  /* change handlers */
  onTitleChange,
  onContentChange,
  onCancel,
  onSave,
  onEdit,
  onDelete,
  onAskAI,
  onDismiss,
}) => {
  /* ——————————————————————————————————————————  context + ui-only state —————————————————————————————————————————— */
  const { open } = useSlideShow();
  const { nodes } = useNodesContext();
  const nodeArray = Array.from(nodes.values());
  const { getFocusNode } = useNodeSelection();

  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cueFlipped, setCueFlipped] = useState(false);
  const topicSelectorRef = useRef<HTMLDivElement>(null);

  /* ——————————————————————————————————————————  focus-node auto-select  —————————————————————————————————————————— */
  useEffect(() => {
    if (
      isEditing &&
      isNewCard &&
      inputData &&
      !inputData.selectedTopicId &&
      !inputData.createNode &&
      onInputDataChange
    ) {
      const focus = getFocusNode();
      if (focus) {
        onInputDataChange({ ...inputData, selectedTopicId: focus });
      }
    }
  }, [isEditing, isNewCard, inputData, onInputDataChange, getFocusNode]);

  /* ——————————————————————————————————————————  click-outside to close dropdown  —————————————————————————————————————————— */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        topicSelectorRef.current &&
        !topicSelectorRef.current.contains(e.target as Node)
      ) {
        setIsTopicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  /* ——————————————————————————————————————————  helpers  —————————————————————————————————————————— */
  const selectTopic = (topicId: string) =>
    onInputDataChange?.({
      ...inputData!,
      createNode: false,
      nodeTitle: '',
      selectedTopicId: topicId,
    });

  const startCreateNewTopic = () =>
    onInputDataChange?.({
      ...inputData!,
      createNode: true,
      nodeTitle: '',
      selectedTopicId: '',
    });

  /* ——————————————————————————————————————————  read-only view renderer (unchanged)  —————————————————————————————————————————— */
  const commonViewProps = { ConceptNodeTitle, title };

  const renderViewBody = () => {
    switch (type) {
      case 'note':
        return <NoteCard {...commonViewProps} content={String(content)} />;
      case 'quiz': {
        let quizType: QuizType = 'multipleChoice';
        let quizData: IQuizQuestion[] = [];
        try {
          const raw =
            typeof content === 'string' ? JSON.parse(content) : content;
          if (raw?.quizType && Array.isArray(raw.quizContent)) {
            quizType = raw.quizType;
            quizData = raw.quizContent;
          }
        } catch {
          /* ignore bad JSON */
        }
        return (
          <QuizCard
            {...commonViewProps}
            content={{ quizType, quizContent: quizData }}
          />
        );
      }
      default:
        return (
          <div
            onClick={() => setCueFlipped((f) => !f)}
            title="Click to flip"
          >
            <CueCard
              title={title}
              content={String(content)}
              flipped={cueFlipped}
            />
          </div>
        );
    }
  };

  /* ——————————————————————————————————————————  edit-mode topic control  —————————————————————————————————————————— */
  const renderTopicControl = () => {
    /* existing resource being edited → locked topic display */
    if (!isNewCard) {
      return (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          <div className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600">
            {ConceptNodeTitle}
          </div>
        </div>
      );
    }

    /* create-new-node flow */
    if (inputData?.createNode) {
      return (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Topic Name
          </label>
          <input
            type="text"
            autoFocus
            value={inputData.nodeTitle || ''}
            onChange={(e) =>
              onInputDataChange?.({
                ...inputData,
                nodeTitle: e.target.value,
              })
            }
            placeholder="Enter new topic name"
            className="w-full border rounded px-3 py-2"
          />
        </div>
      );
    }

    /* standard dropdown selector */
    return (
      <div className="mb-6" ref={topicSelectorRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Topic
        </label>
        <div className="relative">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 border rounded-md"
            onClick={() => setIsTopicDropdownOpen((o) => !o)}
          >
            {inputData?.selectedTopicId
              ? nodes.get(inputData.selectedTopicId)?.title
              : 'Select topic…'}
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </button>

          {isTopicDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 border rounded-md bg-white shadow-lg">
              <input
                type="text"
                placeholder="Search topics…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border-b"
              />

              <div className="max-h-60 overflow-auto">
                {/* — create new topic item — */}
                <div
                  onClick={() => {
                    startCreateNewTopic();
                    setIsTopicDropdownOpen(false);
                  }}
                  className="px-3 py-2 flex items-center cursor-pointer hover:bg-gray-100 text-blue-600 font-medium border-b"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create new topic +
                </div>

                {/* — existing topics — */}
                {nodeArray
                  .filter((n) =>
                    n.title
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        selectTopic(n.id);
                        setIsTopicDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 flex items-center cursor-pointer hover:bg-gray-100 ${
                        n.id === inputData?.selectedTopicId
                          ? 'bg-blue-50'
                          : ''
                      }`}
                    >
                      {n.id === inputData?.selectedTopicId && (
                        <Check className="mr-2 h-4 w-4 text-blue-600" />
                      )}
                      {n.title}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ——————————————————————————————————————————  edit-mode body  —————————————————————————————————————————— */
  const renderEditBody = () => (
    <>
      {renderTopicControl()}

      {/* title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* content */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
           <RichTextEditor
            content={typeof content === 'string' ? content : ''}
            onChange={onContentChange}
            className="min-h-[200px]"
          />
        
      </div>
    </>
  );

  /* ——————————————————————————————————————————  final JSX  —————————————————————————————————————————— */
  return (
    <>
      <BaseResourceCard
        className={`!p-0 flex flex-col relative ${
          isEditing ? 'edit-form-tall' : 'max-h-[24rem]'
        }`}
        tabIndex={isEditing ? 0 : -1}

      >
        {/* top-right controls (view only) */}
        {!isEditing && (
          <div className="absolute top-2 right-2 flex items-center space-x-1">
            <ResourceMenu
              onEdit={onEdit}
              onDelete={onDelete}
              onAskAI={onAskAI}
              resourceType={type}
            />
            <button
              onClick={() =>
                type === 'quiz'
                  ? setQuizOverlayOpen(true)
                  : open(id, false)
              }
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              title="Full screen"
            >
              <Maximize2 className="h-3 w-3 text-gray-500" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-gray-100"
                title="Dismiss"
              >
                <CloseIcon className="h-4 w-4 text-gray-500" />
              </button>
            )}
          </div>
        )}

        {/* main body */}
        <div
          className={`flex-1 overflow-y-auto resource-body ${
            isEditing ? 'pb-0' : 'pb-24'
          }`}
        >
          <div className="px-6 pt-10">
            {isEditing ? renderEditBody() : renderViewBody()}
          </div>
        </div>

        {/* footer (view-only) */}
        {!isEditing && (
          <footer className="absolute bottom-0 left-0 w-full bg-[#F8FBFE] px-4 py-2 text-text-meta text-xs font-medium z-10">
            {ConceptNodeTitle}
          </footer>
        )}
      </BaseResourceCard>

      {/* quiz overlay (unchanged) */}
      {type === 'quiz' && (
        <QuizOverlay
          isOpen={quizOverlayOpen}
          onClose={() => setQuizOverlayOpen(false)}
          quizType={
            typeof content === 'string'
              ? (JSON.parse(content).quizType as QuizType) || 'multipleChoice'
              : 'multipleChoice'
          }
          title={title}
          quizData={
            typeof content === 'string'
              ? (JSON.parse(content)
                  .quizContent as IQuizQuestion[])
              : []
          }
        />
      )}
    </>
  );
};

export default ResourceDisplay;
