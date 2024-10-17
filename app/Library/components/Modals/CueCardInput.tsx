// bloom-maps\app\Library\Tests\Modals\CueCardInput.tsx
import React, { useRef } from 'react';
import { Input, Radio, Upload, Button } from 'antd';
import { InputRef } from 'antd';

interface CueCardInputProps {
  cueCardTitle: string;
  cueCardContent: string;
  bloomLevel: 1 | 2 | 3 | 4 | 5 | 6;
  setCueCardTitle: (title: string) => void;
  setCueCardContent: (content: string) => void;
  setBloomLevel: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  handlePictureUpload: (file: File) => void;
}

const bloomLevelLabels = [
  { level: 1, label: 'Remember' },
  { level: 2, label: 'Understand' },
  { level: 3, label: 'Apply' },
  { level: 4, label: 'Analyze' },
  { level: 5, label: 'Evaluate' },
  { level: 6, label: 'Create' },
];

const CueCardInput: React.FC<CueCardInputProps> = ({
  cueCardTitle,
  cueCardContent,
  bloomLevel,
  setCueCardTitle,
  setCueCardContent,
  setBloomLevel,
  handlePictureUpload
}) => {
  const titleInputRef = useRef<InputRef>(null);
  const cueCardContentRef = useRef<InputRef>(null);

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
};

export default CueCardInput;
