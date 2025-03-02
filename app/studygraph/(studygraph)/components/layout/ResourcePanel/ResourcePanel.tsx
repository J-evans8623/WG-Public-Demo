/**
 * @file ResourcePanel.tsx
 * @description
 *   This component displays the resource panel which includes:
 *     - File name with inline editing.
 *     - A list of lessons with options to add, edit, and delete.
 *     - An uploads section for files.
 *
 *   Responsibilities:
 *     - Allow users to trigger file uploads.
 *     - Display a loading indicator in the uploads section while a file is being processed.
 *     - Display a loading indicator in the lessons section while a concept map is being generated.
 *     - Show the list of uploaded files only after the backend has returned a processed file.
 *     - Automatically switch the active view based on the item clicked:
 *         • Clicking a lesson switches to the Concept Map tab.
 *         • Clicking an upload switches to the Uploads tab.
 *
 *   Update:
 *     - The upload progress bar uses a flexible width of 6.25rem (~100px).
 *     - Automatic tab switching is performed in click handlers.
 *     - Removed percentage text next to the upload progress bar for a cleaner UI.
 *     - Displays a loading bar in the Lessons section when a concept map is being generated.
 *
 * @author  
 * @date    
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  Pencil,
  Plus,
  Upload,
  FileText,
  FolderOpen,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizeHandle } from '../shared/ResizeHandle';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';

interface ResourcePanelProps {
  width: number; // Panel's width in REM when expanded.
  isDragging: boolean;
  dragOffset: number;
  onDragStart: () => void;
  onDrag: (dx: number) => void;
  onDragEnd: () => void;
  isExpanded: boolean;
}

const ResourcePanel: React.FC<ResourcePanelProps> = ({
  width,
  isDragging,
  dragOffset,
  onDragStart,
  onDrag,
  onDragEnd,
  isExpanded,
}) => {
  // Context hooks for lessons and files.
  const {
    getLessonModule,
    addConceptMap,
    deleteConceptMap,
    activeConceptMapId,
    setActiveConceptMapId,
    updateConceptMapTitle,
    isGeneratingLesson, // New state from LessonModuleContext.
  } = useLessonModule();
  const lessonModule = getLessonModule();
  const lessons = lessonModule.conceptMaps;

  const { getAllFiles, addFile, removeFile } = useFileAsset();
  const { setActiveView, setSelectedPdfUrl } = useViewSwitch();
  const { clearSelection } = useNodeSelection();
  const { getFileName, updateFileName } = useYDoc();
  const fileName = getFileName();
  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState(fileName);

  useEffect(() => {
    setFileNameDraft(fileName);
  }, [fileName]);

  // Local state for lesson editing and file uploading.
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for right-click context menu on lessons.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lesson: any } | null>(null);

  // Theme colors for styling.
  const leftPaneBg = "#F6F6F6";
  const leftPaneText = "#1e293b";
  const bgSelected = "#E4E4E4";

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Progress simulation for file uploads.
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    if (isUploading && uploadProgress < 100) {
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const nextProgress = prev + Math.floor(Math.random() * 10 + 5);
          return Math.min(nextProgress, 95); // Cap at 95% until server confirms.
        });
      }, 300);
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isUploading, uploadProgress]);

  /** Handler for adding a new lesson. */
  const handleAddLesson = useCallback(() => {
    addConceptMap('Untitled Lesson');
  }, [addConceptMap]);

  /** Starts editing a given lesson. */
  const startEditingLesson = useCallback((lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.title);
  }, []);

  /** Handles changes to the lesson title input. */
  const handleLessonTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  }, []);

  /** Saves the edited lesson title. */
  const handleLessonTitleSave = useCallback(() => {
    if (editingLessonId && editingTitle.trim()) {
      updateConceptMapTitle(editingLessonId, editingTitle);
      setEditingLessonId(null);
      setEditingTitle('');
    }
  }, [editingLessonId, editingTitle, updateConceptMapTitle]);

  /** Deletes the selected lesson. */
  const handleDeleteLesson = useCallback(
    (lessonId: string) => {
      deleteConceptMap(lessonId);
    },
    [deleteConceptMap]
  );

  /**
   * handleLessonClick
   * @description Handles clicks on a lesson item.
   *              Automatically sets the active lesson ID and switches to the Concept Map view.
   */
  const handleLessonClick = useCallback(
    (lessonId: string, e: React.MouseEvent) => {
      if (!editingLessonId) {
        if (activeConceptMapId !== lessonId) {
          clearSelection();
        }
        setActiveConceptMapId(lessonId);
        // Automatically switch to the Concept Map tab.
        setActiveView('conceptMap');
      }
    },
    [editingLessonId, activeConceptMapId, setActiveConceptMapId, clearSelection, setActiveView]
  );

  /**
   * handleFileUpload
   * @description Handles file selection and uploading.
   *              Sets the uploading state and progress while waiting for the backend response.
   */
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        setCurrentFileName(files[0].name);
        try {
          // Await the addFile call so that file is added only after the backend responds.
          await Promise.all(Array.from(files).map((file) => addFile(file)));
          setUploadProgress(100); // Completed.
          // Automatically switch to the Uploads view.
          setActiveView('pdf');
          // Reset state after complete animation.
          setTimeout(() => {
            setIsUploading(false);
            event.target.value = '';
          }, 1000);
        } catch (error) {
          console.error('File upload failed:', error);
          setIsUploading(false);
        }
      }
    },
    [addFile, setActiveView]
  );

  /** Handles clicking on an uploaded file entry. */
  const handleFileEntryClick = useCallback(
    (file: TextFileMessage) => {
      setSelectedPdfUrl(file.serverUrl);
      // Automatically switch to the Uploads view.
      setActiveView('pdf');
    },
    [setSelectedPdfUrl, setActiveView]
  );

  /** Saves the edited file name. */
  const saveFileName = useCallback(() => {
    updateFileName(fileNameDraft);
    setEditingFileName(false);
  }, [fileNameDraft, updateFileName]);

  // Dynamic width for expanded/collapsed state.
  const computedWidth = isExpanded ? `${width / 16}rem` : '0px';

  return (
    <div
      className={`map-left-pane h-full transition-all duration-300 overflow-hidden ${isExpanded ? 'border-r map-divider' : ''}`}
      style={{
        width: computedWidth,
        minWidth: computedWidth,
        opacity: isDragging ? Math.max(0, 1 + dragOffset / 100) : 1,
        transform: isDragging ? `translateX(${Math.min(0, dragOffset) / 16}rem)` : 'none',
      }}
      onDragStart={onDragStart}
    >
      {isExpanded && (
        <>
          {/* Panel Header with file name and inline edit */}
          <div
            className="px-4 py-3 border-b map-divider flex items-center relative"
            style={{ backgroundColor: leftPaneBg }}
          >
            <FileText className="text-blue-600 mr-2 flex-shrink-0" size={16} />
            {editingFileName ? (
              <Input
                value={fileNameDraft}
                onChange={(e) => setFileNameDraft(e.target.value)}
                onBlur={saveFileName}
                onKeyPress={(e) => e.key === 'Enter' && saveFileName()}
                className="text-sm h-6 py-1 flex-1"
                autoFocus
              />
            ) : (
              <div className="relative flex-1 group">
                <h2
                  className="font-medium text-sm truncate max-w-[14rem] cursor-text py-1 px-2 -mx-2 rounded group-hover:bg-gray-50 group-hover:border group-hover:border-gray-300"
                  title={fileName}
                  onClick={() => setEditingFileName(true)}
                >
                  {fileName}
                </h2>
                <Pencil
                  size={12}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"
                />
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            {/* Lessons Section */}
{/* Lessons Section */}
<div className="mb-6">
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-gray-700 font-small">Lessons</span>
    <div className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddLesson}
        className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
      >
        <Plus size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (activeConceptMapId) {
            const lesson = lessons.find((l: any) => l.id === activeConceptMapId);
            if (lesson) {
              startEditingLesson(lesson);
            }
          }
        }}
        className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
      >
        <Pencil size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (activeConceptMapId) {
            handleDeleteLesson(activeConceptMapId);
          }
        }}
        className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
      >
        <Trash2 size={16} />
      </Button>
    </div>
  </div>
  {/* Display loading indicator if a lesson module is generating */}
  {isGeneratingLesson ? (
    <div className="p-4 rounded-lg" style={{ backgroundColor: leftPaneBg }}>
      <div className="mb-2">
        <span className="text-sm" style={{ color: leftPaneText }}>
          Generating lesson module...
        </span>
      </div>
      {/* Indeterminate Progress Bar */}
      <div className="rounded-full h-2" style={{ backgroundColor: bgSelected, width: "6.25rem" }}>
        <div
          className="h-2 rounded-full animate-pulse transition-all duration-300"
          style={{
            backgroundColor: leftPaneText,
            opacity: 0.8,
            width: "100%"
          }}
        ></div>
      </div>
    </div>
  ) : (
    <div className="space-y-2 pl-1 h-40 overflow-y-auto custom-scrollbar">
      {lessons.map((lesson: any) => {
        const isSelected = activeConceptMapId === lesson.id;
        return (
          <div
            key={lesson.id}
            onClick={(e) => handleLessonClick(lesson.id, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, lesson });
            }}
            className={`cursor-pointer p-2 rounded transition-all duration-200 flex items-center gap-2 ${
              isSelected ? 'map-selected' : 'map-border-l-transparent'
            } map-hover`}
            title={lesson.title}
          >
            {editingLessonId === lesson.id ? (
              <div className="flex-1 min-w-0 mr-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editingTitle}
                  onChange={handleLessonTitleChange}
                  onBlur={handleLessonTitleSave}
                  onKeyPress={(e) => e.key === 'Enter' && handleLessonTitleSave()}
                  className="text-sm h-6 py-1"
                  autoFocus
                />
              </div>
            ) : (
              <span className={isSelected ? 'font-small' : ''}>{lesson.title}</span>
            )}
            <div className="flex-shrink-0 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3 h-3 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditingLesson(lesson);
                      setContextMenu(null);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLesson(lesson.id);
                      setContextMenu(null);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>

            {/* Uploads Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700 font-medium">Uploads</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.docx,.txt,.doc,.pptx"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 h-6 w-6 relative group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 h-60 overflow-y-auto custom-scrollbar">
                {isUploading ? (
                  <div className="p-4 rounded-lg" style={{ backgroundColor: leftPaneBg }}>
                    <div className="mb-2">
                      <span
                        className="text-sm"
                        style={{
                          color: leftPaneText,
                          maxWidth: "70%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentFileName}
                      </span>
                    </div>
                    {/* Progress Bar Container: Using 6.25rem (~100px) for flexible sizing */}
                    <div
                      className="rounded-full h-2"
                      style={{ backgroundColor: bgSelected, width: "6.25rem" }}
                    >
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: leftPaneText,
                          opacity: 0.8,
                          width: `${uploadProgress}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-3 text-sm opacity-75" style={{ color: leftPaneText }}>
                      {uploadProgress < 100 ? 'Uploading file, please wait...' : 'Upload complete!'}
                    </div>
                  </div>
                ) : (
                  getAllFiles().length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed map-border rounded-md">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 text-center">
                        Drag and drop files here or click the upload button above
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Supported: PDF, DOCX, PPTX, TXT</p>
                    </div>
                  ) : (
                    getAllFiles().map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleFileEntryClick(file)}
                        className="cursor-pointer p-2 rounded transition-all duration-200 flex items-center gap-2 map-hover map-border-l-transparent"
                      >
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span title={file.title} className="text-sm truncate max-w-[6rem]">
                          {file.title}
                        </span>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </ScrollArea>

          <ResizeHandle
            placement="right"
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
          />

          {/* Right-click Context Menu for Lessons */}
          {contextMenu && (
            <div
              className="absolute bg-white border border-gray-200 shadow-md z-50"
              style={{ top: contextMenu.y, left: contextMenu.x, width: '8rem' }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="py-1">
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingLesson(contextMenu.lesson);
                    setContextMenu(null);
                  }}
                >
                  <Pencil className="w-3 h-3 mr-2" />
                  Edit
                </button>
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100 text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLesson(contextMenu.lesson.id);
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResourcePanel;
