import React, { useState, useEffect, useContext } from 'react';
import { Modal, Input, Select, List, Button, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { AuthContext} from '@/app/src/context/AuthContext';
import { FrontendDriveService } from  '../../services/frontendDriveService'; 
import type { drive_v3 } from 'googleapis';

/**
 * DriveShareDialog Component
 * 
 * A modal interface for managing file sharing settings in Google Drive.
 * Allows users to share files with specific people and manage existing shares.
 * 
 * Dependencies:
 * - DriveShareService for sharing operations
 * - antd components for UI elements
 */

interface DriveShareDialogProps {
  fileId: string;
  visible: boolean;
  onClose: () => void;
}

const DriveShareDialog: React.FC<DriveShareDialogProps> = ({
  fileId,
  visible,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'reader' | 'writer' | 'commenter'>('reader');
  const [shares, setShares] = useState<drive_v3.Schema$Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);

  // Load existing shares when dialog opens
  useEffect(() => {
    if (visible && user?.accessToken) {
      loadShares();
    }
  }, [visible, fileId, user?.accessToken]);

  /**
   * Loads existing share permissions for the file
   */
  const loadShares = async () => {
    if (!user?.accessToken) {
      message.error('You must be logged in to view sharing settings');
      return;
    }

    try {
      setLoading(true);
      const response = await FrontendDriveService.listFiles(user.accessToken);
      const fileDetails = response.find((file: { id: string; }) => file.id === fileId);
      if (fileDetails?.permissions) {
        setShares(fileDetails.permissions);
      }
    } catch (error) {
      message.error('Failed to load sharing settings');
      console.error('Error loading shares:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles sharing file with new user
   */
  const handleShare = async () => {
    if (!email || !user?.accessToken) return;

    try {
      setLoading(true);
      const settings = {
        type: 'user',
        role,
        emailAddress: email,
      };
      
      await FrontendDriveService.shareFile(fileId, settings, user.accessToken);
      message.success('File shared successfully');
      setEmail('');
      await loadShares();
    } catch (error) {
      message.error('Failed to share file');
      console.error('Error sharing file:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Updates existing share permissions
   */
  const handleUpdatePermission = async (
    permissionId: string,
    newRole: 'reader' | 'writer' | 'commenter'
  ) => {
    if (!user?.accessToken) return;

    try {
      setLoading(true);
      await FrontendDriveService.updateFile(fileId, {
        permissionId,
        role: newRole,
      }, user.accessToken);
      await loadShares();
      message.success('Permission updated successfully');
    } catch (error) {
      message.error('Failed to update permission');
      console.error('Error updating permission:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Share File"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            prefix={<UserOutlined />}
            placeholder="Enter email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Select
            value={role}
            onChange={setRole}
            style={{ width: 120 }}
            options={[
              { label: 'Can view', value: 'reader' },
              { label: 'Can comment', value: 'commenter' },
              { label: 'Can edit', value: 'writer' },
            ]}
          />
          <Button type="primary" onClick={handleShare} loading={loading}>
            Share
          </Button>
        </div>

        <List
          loading={loading}
          dataSource={shares}
          renderItem={permission => (
            <List.Item
              actions={[
                <Select
                  key="role"
                  value={
                    ['reader', 'writer', 'commenter'].includes(permission.role!)
                      ? (permission.role as 'reader' | 'writer' | 'commenter')
                      : undefined
                  }
                  onChange={newRole =>
                    handleUpdatePermission(permission.id!, newRole as 'reader' | 'writer' | 'commenter')
                  }
                  style={{ width: 120 }}
                  options={[
                    { label: 'Can view', value: 'reader' },
                    { label: 'Can comment', value: 'commenter' },
                    { label: 'Can edit', value: 'writer' },
                  ]}
                />
              ]}
            >
              <List.Item.Meta
                avatar={<UserOutlined />}
                title={permission.emailAddress}
                description={`Access: ${permission.role}`}
              />
            </List.Item>
          )}
        />
      </div>
    </Modal>
  );
};

export default DriveShareDialog;