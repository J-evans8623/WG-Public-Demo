import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Upload, X, Plus, FolderPlus } from 'lucide-react';
import { Descendant } from 'slate';
import RichTextEditor from '@/app/Library/components/Modals/RichTextEditor';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { ResourceCard, CueCardResource, PictureResource } from '@/app/Library/Definitions/Definitions';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

interface ResourceToolBarProps {
  selectedParentNode: string;
  activeOperation: 'addContent' | null;
  onClose: () => void;
}

interface FormData {
  resourceTitle: string;
  conceptTitle: string | null;
  content: Descendant[];
  file: File | null;
  showConceptField: boolean;
}

const ResourceToolBar: React.FC<ResourceToolBarProps> = ({
  selectedParentNode,
  activeOperation,
  onClose
}) => {
  const { addResource, addPictureResource } = useResourceContext();
  const { createNewNode, getNodeTitle, updateNodeTitle } = useNodesContext();
  const { addFile } = useFileAsset();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const [sourceNodeTitle, setSourceNodeTitle] = useState<string>('');
  const [isUploadSectionOpen, setIsUploadSectionOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    resourceTitle: '',
    conceptTitle: null,
    content: [{ type: 'paragraph', children: [{ text: '' }] }],
    file: null,
    showConceptField: false
  });

  const [showDescription, setShowDescription] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedParentNode) {
      const currentTitle = getNodeTitle(selectedParentNode);
      if (currentTitle) {
        setSourceNodeTitle(currentTitle);
      }
    }
  }, [selectedParentNode, getNodeTitle]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContentChange = (newContent: Descendant[]) => {
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
  
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          setFormData(prev => ({ ...prev, file }));
          setImagePreview(URL.createObjectURL(file));
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const fileType = file.type.toLowerCase();
      if (fileType.startsWith('image/') ||
          fileType.includes('pdf') ||
          fileType.includes('word') ||
          fileType.includes('text')) {
        setFormData(prev => ({ ...prev, file }));
        if (fileType.startsWith('image/')) {
          setImagePreview(URL.createObjectURL(file));
        }
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = file.type.toLowerCase();
      const isDocument = fileType.includes('pdf') ||
                        fileType.includes('word') ||
                        fileType.includes('text');
      setShowDescription(!isDocument);
      setFormData(prev => ({
        ...prev,
        file: file
      }));
      if (fileType.startsWith('image/')) {
        setImagePreview(URL.createObjectURL(file));
      }
    }
  };

  const isSlateContentEmpty = (content: Descendant[]): boolean => {
    return content.every(node => {
      if ('children' in node) {
        return node.children.every(child => {
          if ('text' in child) {
            return child.text.trim() === '';
          }
          return true;
        });
      }
      return true;
    });
  };

  const toggleConceptField = () => {
    setFormData(prev => ({
      ...prev,
      showConceptField: !prev.showConceptField,
      conceptTitle: prev.showConceptField ? null : prev.conceptTitle
    }));
  };

  const handleSave = async () => {
    const isCreatingResource = formData.file || !isSlateContentEmpty(formData.content);

    if (isCreatingResource && !formData.resourceTitle) {
      alert('Please provide a title for the resource');
      return;
    }

    try {
      const currentTitle = getNodeTitle(selectedParentNode);
      if (currentTitle && sourceNodeTitle !== currentTitle) {
        updateNodeTitle(selectedParentNode, sourceNodeTitle);
      }

      let targetNodeId = selectedParentNode;
      if (formData.showConceptField && formData.conceptTitle) {
        const newNodeId = uuidv4();
        createNewNode(formData.conceptTitle, selectedParentNode, newNodeId);
        layoutDispatch(setGetLayout(true));
        targetNodeId = newNodeId;
      }

      if (formData.file) {
        const fileType = formData.file.type.toLowerCase();
        if (fileType.startsWith('image/')) {
          await addPictureResource({
            nodeId: targetNodeId,
            type: 'picture',
            title: formData.resourceTitle,
            description: showDescription ? formData.content : undefined
          } as Omit<PictureResource, 'id'|'image'>, formData.file);
        } else {
          await addFile(formData.file);
        }
      } else if (!isSlateContentEmpty(formData.content)) {
        await addResource({
          nodeId: targetNodeId,
          type: 'cueCard',
          title: formData.resourceTitle,
          content: formData.content
        } as Omit<CueCardResource, 'id'>);
      }

      setFormData({
        resourceTitle: '',
        conceptTitle: null,
        content: [{ type: 'paragraph', children: [{ text: '' }] }],
        file: null,
        showConceptField: false
      });
      onClose();
    } catch (error) {
      console.error('Error adding content:', error);
    }
  };

  if (activeOperation !== 'addContent') return null;

  const ACCEPTED_FILE_TYPES = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    documents: ['pdf', 'doc', 'docx', 'txt']
  };
  
  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div className="flex-none p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add Content</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Selected Node
            </label>
            <input
              type="text"
              value={sourceNodeTitle}
              onChange={(e) => setSourceNodeTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Enter node title"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={toggleConceptField}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${formData.showConceptField
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              {formData.showConceptField ? 'Cancel New Concept' : 'Add New Concept'}
            </button>
          </div>

          {formData.showConceptField && (
            <div className="pl-4 border-l-2 border-blue-200">
              <label className="block text-sm font-medium text-gray-700">
                New Concept Title
              </label>
              <input
                type="text"
                name="conceptTitle"
                value={formData.conceptTitle || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Enter concept title"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Resource Title
            </label>
            <input
              type="text"
              name="resourceTitle"
              value={formData.resourceTitle}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Enter resource title"
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsUploadSectionOpen(!isUploadSectionOpen)}
               className="flex items-center px-3 py-2 w-full rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File or Image
            </button>
            

            {isUploadSectionOpen && (
              <div
                className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                tabIndex={0}
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      Drag and drop files here, or paste image from clipboard, or
                    </p>
                    <label className="mt-2 cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                      <Plus className="w-4 h-4 mr-2" />
                      Browse
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                      />
                    </label>
                    
                  </div>

                  {formData.file && (
                    <div className="w-full">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-500">{formData.file.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, file: null }));
                            setImagePreview(null);
                          }}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {imagePreview && (
                  <div className="mt-2 max-w-xs mx-auto relative h-[200px]">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="rounded-lg object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">
            <span className="font-medium">
              Images: {ACCEPTED_FILE_TYPES.images.join(', ')}
            </span>
            <br />
            <span className="font-medium">
              Documents: {ACCEPTED_FILE_TYPES.documents.join(', ')}
            </span>
          </p>

          {showDescription && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <RichTextEditor
                value={formData.content}
                onChange={handleContentChange}
                defaultString="Enter description here..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-none p-4 bg-white border-t">
        <button
          type="button"
          onClick={handleSave}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Save Content
        </button>
      </div>
    </div>
  );
};

export default ResourceToolBar;