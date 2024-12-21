/**
 * @file CueCardInput.tsx
 * @description 
 * This file handles the input for creating or editing a cue card.
 * It now uses the RichTextEditor to capture content as Descendant[] 
 * instead of a plain string, enabling rich text formatting.
 * 
 * Responsibilities:
 * - Render an input for the cue card title (plain string).
 * - Render a RichTextEditor for the cue card content (Descendant[]).
 * - Invoke setCueCardTitle and setCueCardContent callbacks on changes.
 * 
 * Inputs:
 * - cueCardTitle: string
 * - cueCardContent: Descendant[]
 * - setCueCardTitle: (title: string) => void
 * - setCueCardContent: (content: Descendant[]) => void
 * - handlePictureUpload: (file: File) => void (unchanged)
 * 
 * Outputs:
 * - Updated title and content states in the parent component.
 */

import React, { useRef } from 'react';
import { Input, Upload, Button } from 'antd';
import { InputRef } from 'antd';
import { Descendant } from 'slate';
import RichTextEditor from './RichTextEditor';

interface CueCardInputProps {
  cueCardTitle: string;
  cueCardContent: Descendant[];
  source: string; // Added source
  setCueCardTitle: (title: string) => void;
  setCueCardContent: (content: Descendant[]) => void;
  setSource: (source: string) => void; // Added setter for source
}

const CueCardInput: React.FC<CueCardInputProps> = ({
  cueCardTitle,
  cueCardContent,
  source,
  setCueCardTitle,
  setCueCardContent,
  setSource,
}) => {
  const titleInputRef = useRef<InputRef>(null);

  // Ensure cueCardContent is initialized to an empty paragraph if it's empty
  const contentValue: Descendant[] = cueCardContent.length > 0 ? cueCardContent : [
    { type: 'paragraph', children: [{ text: '' }], },
  ];

  return (
    <>
      {/* Title Input */}
      <Input
        ref={titleInputRef}
        placeholder="Cue Card Title"
        value={cueCardTitle}
        onChange={(e) => setCueCardTitle(e.target.value)}
        style={{ backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '10px' }}
      />

      {/* Content Editor */}
      <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #ccc', padding: '10px' }}>
        <RichTextEditor
          value={contentValue}
          onChange={(newValue) => setCueCardContent(newValue)}
          defaultString='Add cue card content'
        />
      </div>
            {/* Source Input */}
            <Input
        placeholder="Source (e.g., Chapter 3, Page 84)"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        style={{ backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '10px', marginTop:'10px'}}
      />
    </>
  );
};

export default CueCardInput;

