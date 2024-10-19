// bloom-maps\app\(client-ui)\MenuBar.tsx
import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import AppIcon from '@/app/icons-custom/AppIcon.svg';
import './MenuBar.css'; 

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
  const { state } = useDocumentContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(state.fileName); 

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onTitleChange(newTitle);
  };

  return (
    <div className="menu-bar-container">
      {/* Icon on the left */}
      <div className="menu-bar-icon">
        <AppIcon className="menu-bar-app-icon" />
      </div>
      {/* Content to the right of the icon */}
      <div className="menu-bar-content">
        {/* Document Title */}
        <div className="menu-bar-document-title">
          {isEditingTitle ? (
            <Input
              value={newTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              autoFocus
              className="menu-bar-title-input"
            />
          ) : (
            <span onClick={handleTitleClick} className="menu-bar-title-text">
              {state.fileName}
            </span>
          )}
        </div>
        {/* Menu Buttons */}
        <div className="menu-bar-buttons">
          <Button onClick={onNewDocument} className="menu-bar-button">
            New Document
          </Button>
          <Button onClick={onOpenDocument} className="menu-bar-button">
            Open
          </Button>
          <Button onClick={onSaveDocument} className="menu-bar-button">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MenuBar;
