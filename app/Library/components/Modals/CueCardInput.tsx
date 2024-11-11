// bloom-maps\app\Library\Tests\Modals\CueCardInput.tsx
import React, { useRef } from 'react';
import { Input, Radio, Upload, Button } from 'antd';
import { InputRef } from 'antd';

interface CueCardInputProps {
  cueCardTitle: string;
  cueCardContent: string;
  setCueCardTitle: (title: string) => void;
  setCueCardContent: (content: string) => void;
  handlePictureUpload: (file: File) => void;
}

const CueCardInput: React.FC<CueCardInputProps> = ({
  cueCardTitle,
  cueCardContent,
  setCueCardTitle,
  setCueCardContent,
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
      <Upload beforeUpload={handlePictureUpload} showUploadList={false}>
        <Button>Upload Picture</Button>
      </Upload>
    </>
  );
};

export default CueCardInput;
