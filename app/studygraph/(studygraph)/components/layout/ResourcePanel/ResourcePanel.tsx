import React, { useState } from 'react';
import { 
  ChevronRight,
  ChevronDown,
  Pencil,
  Upload,
  FileText,
  FolderClosed,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizeHandle } from '../shared/ResizeHandle';

interface Lesson {
  id: number;
  title: string;
  isActive: boolean;
}

interface Upload {
  id: number;
  name: string;
}

interface ResourcePanelProps {
  width: number;
  isDragging: boolean;
  dragOffset: number;
  onDragStart: () => void;
  onDrag: (dx: number) => void;
  onDragEnd: () => void;
}

export const ResourcePanel: React.FC<ResourcePanelProps> = ({
  width,
  isDragging,
  dragOffset,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const [moduleTitle, setModuleTitle] = useState("Introduction to Biology");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isLessonsExpanded, setIsLessonsExpanded] = useState(true);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([
    { id: 1, title: "Cell Structure", isActive: true },
    { id: 2, title: "Cell Division", isActive: false },
    { id: 3, title: "New Lesson 3", isActive: false }
  ]);
  const [uploads, setUploads] = useState<Upload[]>([
    { id: 1, name: "Course Outline.pdf" },
    { id: 2, name: "Reference Guide.docx" }
  ]);

  const handleAddLesson = () => {
    const newLesson = {
      id: Math.max(0, ...lessons.map(l => l.id)) + 1,
      title: `Untitled Lesson`,
      isActive: false
    };
    setLessons([...lessons, newLesson]);
  };

  const handleDeleteLesson = (id: number) => {
    setLessons(lessons.filter(lesson => lesson.id !== id));
  };

  const handleEditLesson = (id: number) => {
    setEditingLessonId(id);
  };

  const handleLessonTitleChange = (id: number, newTitle: string) => {
    setLessons(lessons.map(lesson =>
      lesson.id === id ? { ...lesson, title: newTitle } : lesson
    ));
  };

  const handleLessonTitleSave = () => {
    setEditingLessonId(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploads([...uploads, { id: uploads.length + 1, name: file.name }]);
    }
  };

  return (
    <div 
      style={{ 
        width: `${width / 16}rem`,
        opacity: isDragging ? Math.max(0, 1 + dragOffset/100) : 1,
        transform: isDragging ? `translateX(${Math.min(0, dragOffset)/16}rem)` : 'none'
      }}
      className="relative bg-white border-r border-gray-200 transition-all duration-100 overflow-visible flex flex-col h-full -ml-px"
    >
      {/* Module Title */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2 group">
          <FolderClosed className="w-4 h-4 text-blue-600" />
          {isEditingTitle ? (
            <Input
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyPress={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              className="text-sm h-6 py-1"
              autoFocus
            />
          ) : (
            <div className="flex items-center justify-between flex-1">
              <span className="text-sm text-blue-600">{moduleTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 p-1 h-6 w-6"
                onClick={() => setIsEditingTitle(true)}
              >
                <Pencil className="w-3 h-3 text-gray-400" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Lessons Section */}
          <div className="mb-6">
  <div className="flex items-center justify-between mb-2">
    <button 
      onClick={() => setIsLessonsExpanded(!isLessonsExpanded)}
      className="flex items-center text-sm text-gray-700 hover:text-gray-900"
    >
      {isLessonsExpanded ? (
        <ChevronDown className="w-4 h-4 mr-1" />
      ) : (
        <ChevronRight className="w-4 h-4 mr-1" />
      )}
      Lessons
    </button>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleAddLesson}
      className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
    >
      +
    </Button>
  </div>

  {isLessonsExpanded && (
    <div className="space-y-1 pl-1">
      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          className={`group flex items-center px-2 py-1.5 rounded-sm cursor-pointer ${
            lesson.isActive
              ? 'text-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center min-w-0 flex-1">
            <div className="w-4 flex-shrink-0 flex items-center justify-center">
              <span className="text-xs">●</span>
            </div>
            {editingLessonId === lesson.id ? (
              <div className="flex-1 min-w-0 mr-2">
                <Input
                  value={lesson.title}
                  onChange={(e) => handleLessonTitleChange(lesson.id, e.target.value)}
                  onBlur={handleLessonTitleSave}
                  onKeyPress={(e) => e.key === 'Enter' && handleLessonTitleSave()}
                  className="text-sm h-6 py-1"
                  autoFocus
                />
              </div>
            ) : (
              <span className="text-sm ml-1 truncate flex-1">{lesson.title}</span>
            )}
          </div>
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ml-1"
                >
                  <MoreVertical className="w-3 h-3 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => handleEditLesson(lesson.id)}>
                  <Pencil className="w-3 h-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteLesson(lesson.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

          {/* Uploads Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">Uploads</span>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
              />
              <label htmlFor="file-upload" className="inline-block">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 h-6 w-6"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </label>
            </div>

            <div className="space-y-1">
              {uploads.length === 0 ? (
                <div className="text-sm text-gray-500">No uploads</div>
              ) : (
                uploads.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center space-x-2 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-sm cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <ResizeHandle
        placement="right"
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    </div>
  );
};

export default ResourcePanel;