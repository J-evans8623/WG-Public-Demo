import React, { useState, useEffect, useContext } from 'react';
import { Modal, Input, List, Spin, message } from 'antd';
import { SearchOutlined, FileOutlined } from '@ant-design/icons';
import { FrontendDriveService } from  '../../services/frontendDriveService';  //'../services/frontendDriveService';
import type { DriveFile } from '../../../src/services/driveService';
import { AuthContext} from '@/app/src/context/AuthContext';

interface DriveFileSelectorProps {
  visible: boolean;
  onSelect: (fileId: string) => void;
  onCancel: () => void;
}

const DriveFileSelector: React.FC<DriveFileSelectorProps> = ({
  visible,
  onSelect,
  onCancel,
}) => {
  const {user } = useContext(AuthContext);  // Get access token from auth context
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Fetch files when modal becomes visible
  useEffect(() => {
    if (visible && user?.accessToken) {
      loadFiles();
    }
  }, [visible, user]);

  /**
   * Loads all .bloomdocx files from Google Drive through the API
   */
  const loadFiles = async () => {
    try {
      if (user?.accessToken){
        setLoading(true);
        const driveFiles = await FrontendDriveService.listFiles(user?.accessToken);
        setFiles(driveFiles);
      }

    } catch (error) {
      message.error('Failed to load files from Google Drive');
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters files based on search term
   */
  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Handles file selection and closes modal
   */
  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile);
    }
  };

  return (
    <Modal
      title="Select File from Google Drive"
      open={visible}
      onCancel={onCancel}
      onOk={handleSelect}
      okButtonProps={{ disabled: !selectedFile }}
      width={600}
    >
      <div className="mb-4">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search files..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <List
          dataSource={filteredFiles}
          renderItem={file => (
            <List.Item
              className={`cursor-pointer transition-colors ${
                selectedFile === file.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelectedFile(file.id)}
            >
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={file.name}
                description={`Last modified: ${
                  file.modifiedTime
                    ? new Date(file.modifiedTime).toLocaleString()
                    : 'Unknown'
                }`}
              />
            </List.Item>
          )}
          locale={{ emptyText: 'No files found' }}
        />
      )}
    </Modal>
  );
};

export default DriveFileSelector;