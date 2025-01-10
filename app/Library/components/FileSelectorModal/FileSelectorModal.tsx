/**
 * File: /app/Library/components/FileSelectorModal/FileSelectorModal.tsx
 * Responsibility: Render a modal that allows users to browse, search, filter, and select files from Google Drive.
 * Dependencies:
 *   - React and related hooks for state management.
 *   - Ant Design components for UI elements.
 *   - ApiContext for fetching file data.
 *   - CSS for styling.
 */

import React, { useState, useEffect, useContext } from 'react';
import { Modal, Input, List, Button, Spin, Pagination, Tooltip } from 'antd';
import { ApiContext, DriveFile } from '@/app/src/context/ApiContext';
import { SearchOutlined, FileOutlined, FileTextOutlined } from '@ant-design/icons';
import './FileSelectorModal.css'; // Import custom CSS for additional styling

interface FileSelectorModalProps {
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Callback for closing the modal
  onSelect: (fileId: string) => void; // Callback for selecting a file
}

const FileSelectorModal: React.FC<FileSelectorModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { listFiles } = useContext(ApiContext);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    } else {
      // Reset state when modal is closed
      setFiles([]);
      setSearchQuery('');
      setCurrentPage(1);
      setSelectedFileId(null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /**
   * Fetches files from Google Drive using the ApiContext's listFiles method.
   */
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const fetchedFiles = await listFiles(searchQuery);
      setFiles(fetchedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      // Optionally, display an error message to the user
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles the search input change and triggers file fetching with the new query.
   * @param e - Change event from the input field.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  /**
   * Handles the search submission.
   */
  const handleSearch = () => {
    setCurrentPage(1);
    fetchFiles();
  };

  /**
   * Handles the selection of a file.
   * @param fileId - The ID of the selected file.
   */
  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  /**
   * Handles the confirmation of file selection.
   */
  const handleConfirmSelect = () => {
    if (selectedFileId) {
      onSelect(selectedFileId);
    }
  };

  /**
   * Handles page change in pagination.
   * @param page - The new page number.
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  /**
   * Calculates the files to display on the current page.
   */
  const paginatedFiles = files.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Modal
      title="Select a File from Google Drive"
      visible={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="select"
          type="primary"
          onClick={handleConfirmSelect}
          disabled={!selectedFileId}
          loading={isSubmitting}
        >
          Select
        </Button>,
      ]}
      width={800}
    >
      {/* Search Bar */}
      <Input
        placeholder="Search files by name"
        prefix={<SearchOutlined />}
        value={searchQuery}
        onChange={handleSearchChange}
        onPressEnter={handleSearch}
        allowClear
        style={{ marginBottom: 16 }}
      />
      <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />} style={{ marginBottom: 16 }}>
        Search
      </Button>

      {/* File List */}
      {loading ? (
        <Spin tip="Loading files..." />
      ) : (
        <>
<List
  itemLayout="horizontal"
  dataSource={paginatedFiles}
  renderItem={file => (
    <List.Item
      key={file.id} // Added key prop here
      onClick={() => handleFileSelect(file.id)}
      className={`file-item ${selectedFileId === file.id ? 'selected' : ''}`}
      actions={[
        <Tooltip title="Select this file" key="select-tooltip"> {/* Added key prop here */}
          <Button type="link" onClick={() => handleFileSelect(file.id)}>
            Select
          </Button>
        </Tooltip>,
      ]}
    >
<List.Item.Meta
  avatar={
    file.mimeType === 'application/vnd.google-apps.document' ? <FileTextOutlined /> : <FileOutlined />
  }
  title={file.name}
  description={`Type: ${file.mimeType} | Modified: ${
    file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Unknown date'
  }`}
/>

    </List.Item>
  )}
/>

          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={files.length}
            onChange={handlePageChange}
            style={{ textAlign: 'center', marginTop: 16 }}
          />
        </>
      )}
    </Modal>
  );
};

export default FileSelectorModal;
