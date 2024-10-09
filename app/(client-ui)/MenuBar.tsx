import React, { useState } from 'react';
import { Menu, Input, Button } from 'antd';

interface MenuBarProps {
  documentTitle: string;
  onTitleChange: (newTitle: string) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onHelp: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  documentTitle,
  onTitleChange,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onHelp,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(documentTitle);

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
              {documentTitle}
            </span>
          )}
        </div>
        <div className="menu-buttons">
          <Button
            onClick={onNewDocument}
            className="menu-button"
          >
            New Document
          </Button>
          <Button
            onClick={onOpenDocument}
            className="menu-button"
          >
            Open
          </Button>
          <Button
            onClick={onSaveDocument}
            className="menu-button"
          >
            Save
          </Button>
        </div>
      </div>
      <div className="menu-right">
        <Button
          onClick={onHelp}
          className="menu-button help-button"
        >
          Help
        </Button>
      </div>
    </div>
  );
};

export default MenuBar;
