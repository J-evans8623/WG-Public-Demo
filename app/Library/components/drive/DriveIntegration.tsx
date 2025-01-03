/**
 * app/components/DriveIntegration.tsx
 * 
 * React components for Google Drive integration UI.
 */

import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Switch, Select, Input, message } from 'antd';
import { AuthContext } from '../../../src/context/AuthContext';
import AutoSaveService from '../../../src/services/autoSaveService';
import DriveShareService from '../../../src/services/driveShareService';




export const AutoSaveControl: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState(30);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    AutoSaveService.configure({
      enabled: checked,
      interval: interval * 1000
    });
  };

  return (
    <div className="flex items-center space-x-4">
      <Switch checked={enabled} onChange={handleToggle} />
      <span>AutoSave</span>
      {enabled && (
        <Select 
          value={interval}
          onChange={value => {
            setInterval(value);
            AutoSaveService.configure({
              enabled,
              interval: value * 1000
            });
          }}
        >
          <Select.Option value={30}>30 seconds</Select.Option>
          <Select.Option value={60}>1 minute</Select.Option>
          <Select.Option value={300}>5 minutes</Select.Option>
        </Select>
      )}
    </div>
  );
};

export const ShareModal: React.FC<{
  fileId: string;
  visible: boolean;
  onClose: () => void;
}> = ({ fileId, visible, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'reader' | 'writer' | 'commenter'>('reader');

  const handleShare = async () => {
    try {
      await DriveShareService.shareFile(fileId, {
        type: 'user',
        role,
        emailAddress: email
      });
      message.success('File shared successfully');
      onClose();
    } catch (error) {
      message.error('Failed to share file');
    }
  };

  return (
    <Modal
      title="Share Document"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="share" type="primary" onClick={handleShare}>Share</Button>
      ]}
    >
      <div className="space-y-4">
        <div>
          <Input
            placeholder="Enter email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Select value={role} onChange={value => setRole(value)} className="w-full">
            <Select.Option value="reader">Can view</Select.Option>
            <Select.Option value="commenter">Can comment</Select.Option>
            <Select.Option value="writer">Can edit</Select.Option>
          </Select>
        </div>
      </div>
    </Modal>
  );
};