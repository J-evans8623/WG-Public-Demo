// bloom-maps\app\(client-ui)\MenuBar.tsx
import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider'; // Import useDocumentContext

interface MenuBarProps {
  onTitleChange: (newTitle: string) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onHelp: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onTitleChange,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onHelp,
}) => {
  const { state, dispatch } = useDocumentContext();  // Get fileName from context
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(state.fileName);  // Initialize with current fileName

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onTitleChange(newTitle);  // Trigger the title change event to update the state
  };

  return (
    <div className="menu-bar">
      <div className="menu-left">
        <div className="document-title">
          {isEditingTitle ? (
            <Input
              value={newTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              autoFocus
              style={{ width: '300px' }} // Ensure input field fits well
            />
          ) : (
            <span
              onClick={handleTitleClick}
              style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '18px' }} // Title styling
            >
              {state.fileName}  {/* Display the file name from the context */}
            </span>
          )}
        </div>
        <div className="menu-buttons">
          <Button onClick={onNewDocument} className="menu-button">New Document</Button>
          <Button onClick={onOpenDocument} className="menu-button">Open</Button>
          <Button onClick={onSaveDocument} className="menu-button">Save</Button>
        </div>
      </div>
      <div className="menu-right">
        <Button onClick={onHelp} className="menu-button help-button">Help</Button>
      </div>
    </div>
  );
};

export default MenuBar;
