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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApiContext, useFileList } from '@/app/src/context/ApiContext';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { Trash, Calendar, Map, Book, Sparkles, Check } from 'lucide-react';
import { Role } from '../../../types/access';
import { deleteDocBytes } from '../../../services/localCacheStore';
import ReactDOM from 'react-dom';

// Import Modal Components
import CalendarModal from '@/app/workspace/(studygraph)/components/layout/Calendar/CalendarModal';
import OnboardingModal, { TUTORIAL_DATA, TutorialContent } from './onboarding-modal';

// Import Styles
import './homeScreenV3.css';
import './file-tile.css';

import StudyLogCard from './studylog/StudyLogCard';
import StudyLogModal from './studylog/StudyLogModal';

import { useStudyLog } from '@/app/Library/Context/studylog/StudyLogContext';
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';

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

  // Step 4 (NEW): Study Log modal state
  const [isStudyLogModalOpen, setIsStudyLogModalOpen] = useState(false);

  const { summary: studyLogSummary } = useStudyLog();
  
  // update - 4: Consumed completedSessions to calculate progress
  const { getSessionsForWeek, completedSessions } = useCalendar();

  const openCalendarModal = () => {
    setIsCalendarModalOpen(true);
  };

  const closeCalendarModal = () => {
    setIsCalendarModalOpen(false);
  };


    const openStudyLogModal = () => {
    setIsStudyLogModalOpen(true);
  };

  const closeStudyLogModal = () => {
    setIsStudyLogModalOpen(false);
  };

  useEffect(() => {
    if (isCalendarModalOpen || isTutorialOpen || isStudyLogModalOpen)  {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCalendarModalOpen, isStudyLogModalOpen, isTutorialOpen]);

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
        // Sort by updatedAt descending so newest files (owned or shared) appear first
        files = [...ownedFiles, ...sharedFiles].sort((a, b) => {
            const dateA = new Date(a.updatedAt || 0).getTime();
            const dateB = new Date(b.updatedAt || 0).getTime();
            return dateB - dateA;
        });
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


  const FileTileSkeleton = () => (
  <div className="file-tile skeleton">
    <div className="file-header-row">
      <div className="skeleton-icon skeleton-bg" />
      <div style={{ flex: 1, paddingLeft: '10px' }}>
        <div className="skeleton-text title skeleton-bg" />
        <div className="skeleton-text skeleton-bg" style={{ width: '40%' }} />
      </div>
    </div>
    <div className="file-footer">
      <div className="skeleton-text meta skeleton-bg" />
    </div>
  </div>
);


// --- Logic: Study Log Metrics ---

  // update - 5: Calculate Weekly Sessions from Calendar Context (Scheduled vs Completed)
  const { weeklySessionsCompleted, weeklyGoalSessions } = useMemo(() => {
    const sessionsThisWeek = getSessionsForWeek(new Date());
    
    // Count how many of this week's session IDs are in the completed set
    const completedCount = sessionsThisWeek.filter(s => completedSessions.includes(s.id)).length;
    
    return {
      weeklySessionsCompleted: completedCount,
      weeklyGoalSessions: sessionsThisWeek.length
    };
  }, [getSessionsForWeek, completedSessions]);

  // update - 6: Calculate Weekly Hours from StudyLog Summary
  const weeklyHours = studyLogSummary.weeklyStudySeconds / 3600;

  // update - 7: Helper to resolve notebook names for the Modal's distribution list
  const getNotebookName = useCallback((id: string) => {
    const file = ownedFiles.find(f => f.fileId === id);
    return file ? file.fileName : 'Unknown Notebook';
  }, [ownedFiles]);

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
                  <div className="action-title">How to Generate a Lesson</div>
                  <div className="action-desc">AI-powered creation</div>
                </div>

                {/* Study planner- Opens Tutorial */}
                <div 
                  className="action-tile" 
                  onClick={() => handleOpenTutorial('study_planner', openCalendarModal)}
                >
                  <Map className="action-icon" />
                  <div className="action-title">Create your first study plan</div>
                  <div className="action-desc">Tutorial</div>
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
                  {/**<div
                    className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('favorites')}
                  >
                    Favorites
                  </div>**/}
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
                  <div className="files-grid">
                    {/* Render 8 skeletons to fill the grid area */}
                    {[...Array(8)].map((_, i) => (
                      <FileTileSkeleton key={i} />
                    ))}
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
            <StudyLogCard
              weeklyHours={Number(weeklyHours.toFixed(1))}
              weeklySessions={weeklySessionsCompleted}
              weeklyGoalHours={weeklyGoalSessions} // Interpreted as sessions count by the component
              onOpenDetails={openStudyLogModal}
              badgeLabel="This week"
            />

            <div className="assistant-card">
              <h3 className="panel-title">Learn</h3>
              
              {/* Study Planner Hero Tutorial - Retains Tutorial + Action */}
              <div
                className="learn-card-content"
                onClick={() => handleOpenTutorial('study_group')}
              >
                <div className="learn-title">How to create a study group</div>
                <div className="learn-desc">Share your notebook with your peers and study together</div>
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

      {/* Study Log Modal (NEW) */}
      <StudyLogModal
        isOpen={isStudyLogModalOpen}
        onClose={closeStudyLogModal}
        totalHours={weeklyHours}
        totalSessions={weeklySessionsCompleted}
        notebookStats={studyLogSummary.notebookStats || {}} // update - 10: Fallback to empty if undefined
        getNotebookName={getNotebookName}
        initialTab="week"
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