// src/app/dashboard/components/HomescreenV3.tsx

/***************************************************************************************
 * @file HomescreenV3.tsx
 * @description
 * The HomescreenV3 component represents the next generation of the BloomMap application's
 * home interface.
 * * UPDATES:
 * - Restored direct access to Calendar Modal for the "View Study Planner" Quick Action.
 * - Sidebar "Learn" card still triggers the Study Planner Tutorial.
 ***************************************************************************************/

import React, { useState, useEffect } from 'react';
import { useApiContext, useFileList } from '@/app/src/context/ApiContext';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { Trash, Calendar, Users, Book, Sparkles, Check } from 'lucide-react';
import { Role } from '../../../types/access';
import { deleteDocBytes } from '../../../services/localCacheStore';
import ReactDOM from 'react-dom';

// Import Modal Components
import CalendarModal from '@/app/studygraph/(studygraph)/components/layout/Calendar/CalendarModal';
import OnboardingModal, { TUTORIAL_DATA, TutorialContent } from './onboarding-modal';

// Import Styles
import './homeScreenV3.css';
import './file-tile.css';

import type { PickerFileMeta as CalendarPickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';

/**
 * @type PickerFileMeta
 */
export type PickerFileMeta = {
  fileId: string;
  docId: string;
  colorCode?: string;
  fileStorageId?: string;
  fileName: string;
  role?: Role;
  updatedAt?: string;
};

interface HomeScreenProps {
  onFileSelect: (payload: PickerFileMeta | string) => void;
  onCreateNewDocument: () => void;
}

/**
 * @function HomescreenV3
 */
const HomescreenV3: React.FC<HomeScreenProps> = ({
  onFileSelect,
  onCreateNewDocument,
}) => {
  // Step 1: Initialize API context and state management hooks
  const { deleteFile } = useApiContext();
  const { ownedFiles, sharedFiles, isHydrated, refresh } = useFileList();
  const [greeting, setGreeting] = useState('');

  const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'shared'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Step 2: Modal state for Onboarding Tutorials
  const [activeTutorial, setActiveTutorial] = useState<TutorialContent | null>(null);
  const [postTutorialAction, setPostTutorialAction] = useState<(() => void) | null>(null);
  const isTutorialOpen = !!activeTutorial;

  // Step 3: Calendar modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const openCalendarModal = () => {
    setIsCalendarModalOpen(true);
  };

  const closeCalendarModal = () => {
    setIsCalendarModalOpen(false);
  };

  useEffect(() => {
    if (isCalendarModalOpen || isTutorialOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCalendarModalOpen, isTutorialOpen]);

  // Step 4: Initialize component on mount
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' :
      'Good evening'
    );
  }, []);

  // --- Handlers ---

  const handleDeleteFile = async (path: string, docId: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteFile(path);
        await refresh();
        deleteDocBytes(docId);
      } catch (err) {
        console.error('HomescreenV3.tsx › File deletion error:', err);
      }
    }
  };

  const buildPickerMeta = (file: UserFileMetadata): PickerFileMeta => {
    const meta: PickerFileMeta = {
      fileId: file.fileId,
      docId: file.fileId,
      colorCode: file.colorCode,
      fileStorageId: file.fileStoragePath,
      fileName: file.fileName,
      role: file.role,
      updatedAt: file.updatedAt,
    };
    return meta;
  };

  // --- Tutorial Handling Logic ---

  /**
   * Opens a specific tutorial modal.
   * @param tutorialKey - The key corresponding to TUTORIAL_DATA
   * @param nextAction - Optional callback to execute after "Start Exploring" is clicked
   */
  const handleOpenTutorial = (tutorialKey: string, nextAction?: () => void) => {
    const content = TUTORIAL_DATA[tutorialKey];
    if (content) {
      setActiveTutorial(content);
      if (nextAction) {
        setPostTutorialAction(() => nextAction);
      } else {
        setPostTutorialAction(null);
      }
    }
  };

  const handleTutorialClose = () => {
    setActiveTutorial(null);
    setPostTutorialAction(null);
  };

  const handleTutorialComplete = () => {
    if (postTutorialAction) {
      postTutorialAction();
    }
    handleTutorialClose();
  };

  // --- Filtering Logic ---

  const getFilteredFiles = () => {
    let files: UserFileMetadata[] = [];

    switch (activeTab) {
      case 'recent':
        files = ownedFiles;
        break;
      case 'shared':
        files = sharedFiles;
        break;
      case 'favorites':
        files = [];
        break;
      default:
        files = ownedFiles;
    }

    if (searchQuery.trim()) {
      files = files.filter(file =>
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return files;
  };

  const formatFileTime = (timestamp?: string): string => {
    if (!timestamp) return 'Unknown date';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  // Static list for "Learn" section mapping
  const learningTopics = [
    {
      title: 'How to upload and view your personal documents',
      description: 'Discover how to upload your files and view them directly within your workspace.',
      tutorialKey: 'uploads'
    },
    {
      title: 'Chat with your personal AI tutor',
      description: 'Explore interactive sessions with our AI tutor for personalized guidance and support.',
      tutorialKey: 'ai_tutor'
    },
  ];

  return (
    <div className="home-screen-v3">

      {/* Main Container */}
      <div className="main-container">
        {/* Content Wrapper */}
        <div className="content-wrapper">
          {/* Main Content - Scrollable */}
          <div className="main-content">
            {/* Welcome Section */}
            <div className="welcome-section">
              <h1 className="welcome-title">{greeting}</h1>
              <p className="welcome-subtitle">Recent documents you have worked on</p>
            </div>

            {/* Quick Actions Card */}
            <div className="actions-card">
              <div className="actions-grid">
                {/* New Notebook - Standard Action */}
                <div className="action-tile" onClick={onCreateNewDocument}>
                  <Book className="action-icon" />
                  <div className="action-title">New Notebook</div>
                  <div className="action-desc">Create fresh notes</div>
                </div>

                {/* Study Planner - DIRECT LAUNCH (Updated) */}
                <div 
                  className="action-tile" 
                  onClick={openCalendarModal}
                >
                  <Calendar className="action-icon" />
                  <div className="action-title">View Study Planner</div>
                  <div className="action-desc">Organize schedule</div>
                </div>

                {/* Generate Lesson - Opens Tutorial */}
                <div 
                  className="action-tile" 
                  onClick={() => handleOpenTutorial('generate_lesson')}
                >
                  <Sparkles className="action-icon" />
                  <div className="action-title">Generate Lesson</div>
                  <div className="action-desc">AI-powered creation</div>
                </div>

                {/* Study Group - Opens Tutorial */}
                <div 
                  className="action-tile" 
                  onClick={() => handleOpenTutorial('study_group')}
                >
                  <Users className="action-icon" />
                  <div className="action-title">Start Study Group</div>
                  <div className="action-desc">Collaborate</div>
                </div>
              </div>
            </div>

            {/* Files Section Card */}
            <div className="files-card">
              <div className="files-header">
                <div className="files-header-top">
                  <div className="files-title">Your Notebooks</div>
                  <div className="files-search">
                    <input
                      type="text"
                      className="files-search-input"
                      placeholder="Search notebooks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="tab-controls">
                  <div
                    className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recent')}
                  >
                    Recent
                  </div>
                  <div
                    className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('favorites')}
                  >
                    Favorites
                  </div>
                  <div
                    className={`tab ${activeTab === 'shared' ? 'active' : ''}`}
                    onClick={() => setActiveTab('shared')}
                  >
                    Shared
                  </div>
                </div>
              </div>

              <div className="files-content">
                {!isHydrated ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6C757D' }}>
                    Loading your files...
                  </div>
                ) : getFilteredFiles().length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📄</div>
                    <h3 className="empty-title">
                      {activeTab === 'favorites' ? 'No pinned files' :
                        activeTab === 'shared' ? 'No shared files' : 'No recent files'}
                    </h3>
                    <p className="empty-description">
                      {activeTab === 'favorites' ? 'You currently have no pinned files.' :
                        activeTab === 'shared' ? 'No files have been shared with you.' :
                        'Create your first document to get started.'}
                    </p>
                  </div>
                ) : (
                  <div className="files-grid">
                    {getFilteredFiles().map((file) => (
                      <div
                        key={file.fileId}
                        className="file-tile"
                        style={{
                          '--accent-color': file.colorCode || '#C8E6C9'
                        } as React.CSSProperties}
                        onClick={() => {
                          const meta = buildPickerMeta(file);
                          onFileSelect(meta);
                        }}
                      >
                        {/* Header Row with Icon and Title */}
                        <div className="file-header-row">
                          <div className="file-icon-small">
                            <Book size={16} strokeWidth={1.5} />
                          </div>
                          <div className="file-title" title={file.fileName}>
                            {file.fileName}
                          </div>
                        </div>

                        {/* Footer Section with Meta data */}
                        <div className="file-footer">
                          <div className="file-meta">
                            <span className="file-time">{formatFileTime(file.updatedAt)}</span>
                          </div>
                        </div>

                        {/* Delete Button Overlay */}
                        {activeTab === 'recent' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.fileStoragePath, file.fileId);
                            }}
                            className="delete-button"
                            title="Delete File"
                          >
                            <Trash className="trash-icon" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Assistant Panel - Fixed Position */}
          <div className="assistant-panel">
            <div className="assistant-card">
              <h3 className="panel-title">Assistant & Tips</h3>
              
              <div className="checklist-item">
                <div className="check-icon"><Check size={12} /></div>
                <div>
                  <div><strong>Get Started</strong></div>
                  <div style={{ fontSize: '11px', color: '#6C757D' }}>Create a new document</div>
                </div>
              </div>

              {/* Uploads Tutorial Trigger */}
              <div 
                className="checklist-item" 
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenTutorial('uploads')}
              >
                <div className="check-icon"><Check size={12} /></div>
                <div>
                  <div><strong>Upload files</strong></div>
                  <div style={{ fontSize: '11px', color: '#6C757D' }}>Import your materials</div>
                </div>
              </div>

              <div className="checklist-item">
                <div className="check-icon">3</div>
                <div>
                  <div><strong>Learn with tutorials</strong></div>
                  <div style={{ fontSize: '11px', color: '#6C757D' }}>Master the features</div>
                </div>
              </div>
            </div>

            <div className="assistant-card">
              <h3 className="panel-title">Learn</h3>
              
              {/* Study Planner Hero Tutorial - Retains Tutorial + Action */}
              <div
                className="learn-card-content"
                onClick={() => handleOpenTutorial('study_planner', openCalendarModal)}
              >
                <div className="learn-title">Create a Study Planner</div>
                <div className="learn-desc">Learn how to organize and schedule your study sessions effectively</div>
              </div>

              {/* Dynamic Learn Topics */}
              {learningTopics.map((topic, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onClick={() => handleOpenTutorial(topic.tutorialKey)}
                  style={{ marginTop: '8px' }}
                >
                  <div><strong>{topic.title}</strong></div>
                  <div style={{ fontSize: '11px', color: '#6C757D' }}>{topic.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Tutorial Modal */}
      <OnboardingModal 
        isOpen={!!activeTutorial}
        content={activeTutorial}
        onClose={handleTutorialClose}
        onComplete={handleTutorialComplete}
      />

      {/* Calendar Modal Portal */}
      {isCalendarModalOpen &&
        ReactDOM.createPortal(
          <CalendarModal
            isOpen={isCalendarModalOpen}
            onClose={closeCalendarModal}
            onFileSelect={(meta: CalendarPickerFileMeta) => {
              const param = {
                ...meta,
                fileId: meta.docId,
              } satisfies PickerFileMeta
              onFileSelect(param);
            }}
          />,
          document.body
        )
      }

    </div>
  );
};

export default HomescreenV3;