/***************************************************************************************
 * @file HomescreenV3.tsx
 * @description
 *   The HomescreenV3 component represents the next generation of the BloomMap application's
 *   home interface, featuring a completely redesigned layout with enhanced visual hierarchy
 *   and improved user experience. This component maintains all core functionality from
 *   HomescreenV2 including stateful data fetching via ApiContext hooks, file management
 *   operations, deletion flows with confirmations, and modal displays for tutorials.
 *   
 *   The new design introduces a sophisticated grid-based layout with a collapsible navigation
 *   panel, streamlined quick actions, and a dedicated files section with internal scrolling
 *   and tabbed organization. The component features enhanced visual styling with improved
 *   color coding for file types, better contrast ratios, and modern card-based interfaces.
 *   The right-side assistant panel provides contextual help and suggestions to guide users
 *   through their workflow.
 *   
 *   Key architectural improvements include a fixed-height files section with internal
 *   scrolling to prevent layout shifts, responsive design patterns, and comprehensive
 *   accessibility features. The component preserves all existing API integration patterns
 *   while introducing enhanced error handling and user feedback mechanisms. Diagnostic
 *   console logging with unique identifiers continues to provide observability for
 *   debugging and performance monitoring across all major execution paths.
 ***************************************************************************************/

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useApiContext , useFileList} from '@/app/src/context/ApiContext';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { Trash, Calendar, Users, Book, Sparkles } from 'lucide-react';
import './homeScreenV3.css';
import { Role } from '../types/access';
import { deleteDocBytes } from '../services/localCacheStore';

import ReactDOM from 'react-dom';
import CalendarModal from '@/app/studygraph/(studygraph)/components/layout/Calendar/CalendarModal'; 
import type { PickerFileMeta as CalendarPickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';


/**
 * @type PickerFileMeta
 * @description
 *   Payload emitted to the parent on tile click. The parent uses this to update
 *   AccessLayer synchronously and then load the file's bytes. `updatedAt` prefers
 *   ISO strings to align with AccessLayer's newest-wins logic.
 */
export type PickerFileMeta = {
  fileId: string;
  docId:string // same as filleID
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
 * @description
 *   Primary functional component that renders the new home screen interface with enhanced
 *   visual design and preserved functionality from V2. Manages navigation state, file
 *   operations, search functionality, and tab switching while maintaining compatibility
 *   with existing API patterns and data structures.
 */
const HomescreenV3: React.FC<HomeScreenProps> = ({
  onFileSelect,
  onCreateNewDocument,
}) => {
  // Step 1: Initialize API context and state management hooks
  const { deleteFile } = useApiContext();
  const { ownedFiles, sharedFiles, isHydrated, isRefreshing, refresh } = useFileList();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'shared'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Step 3: Modal state for learning content
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    description: string;
  } | null>(null);


  /**
 * @function openCalendarModal
 * @description
 *   Opens the study planner (CalendarModal) from Homescreen quick action.
 *   Mirrors CanvasView’s logging and modal-wiring approach for consistency.
 */
const openCalendarModal = () => {
  // Step 1: Log intent with file-scoped tag for observability
  // console.log('HomescreenV3.tsx [4001] › Opening calendar modal via Quick Action');

  // Step 2: Flip local visibility boolean
  setIsCalendarModalOpen(true);
};

/**
 * @function closeCalendarModal
 * @description
 *   Closes the study planner modal and restores page scrolling if needed.
 */
const closeCalendarModal = () => {
  // Step 1: Log close intent
  // console.log('HomescreenV3.tsx [4002] › Closing calendar modal');

  // Step 2: Reset local state
  setIsCalendarModalOpen(false);
};

/* ─────────────────────── Calendar modal state ──────────────────────────── */
const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

/**
 * @effect Scroll lock while CalendarModal is open (optional UX parity)
 * @description
 *   Prevent background scroll when the overlay is visible. Cleans up on close.
 */
useEffect(() => {
  // Step 1: Lock scroll on open
  if (isCalendarModalOpen) {
    document.body.style.overflow = 'hidden';
  }

  // Step 2: Cleanup / unlock on close or unmount
  return () => {
    document.body.style.overflow = '';
  };
}, [isCalendarModalOpen]);


  // Step 4: Initialize component on mount
  useEffect(() => {
    // console.log('HomescreenV3.tsx 3001 › Component initialization start');
    
    // Set greeting based on time of day
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' :
      'Good evening'
    );
    
    // console.log('HomescreenV3.tsx 3002 › Initial setup complete');
  }, []);



  /**
   * @function handleDeleteFile
   * @description
   *   Prompts user for confirmation before deleting a file, executes the deletion
   *   via API context, and refreshes the file list. Includes comprehensive error
   *   handling and user feedback mechanisms.
   */
  const handleDeleteFile = async (path: string, docId:string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      // console.log('HomescreenV3.tsx 3009 › Delete confirmation received for:', path);
      try {
        await deleteFile(path);
        // console.log('HomescreenV3.tsx 3010 › File deletion successful:', path);
        await refresh(); // Refresh file list after deletion
        deleteDocBytes(docId);
      } catch (err) {
        console.error('HomescreenV3.tsx 3011 › File deletion error:', err);
      }
    }
  };

  /**
   * @function buildPickerMeta
   * @description
   *   Constructs the PickerFileMeta object from UserFileMetadata with proper
   *   role information and ISO timestamp formatting for compatibility with
   *   AccessLayer synchronization logic.
   */
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
    
    // console.log('HomescreenV3.tsx 3012 › PickerMeta constructed with role:', meta);
    return meta;
  };



  /**
   * @function openLearningModal
   * @description
   *   Opens the learning modal with specified title and description content
   *   for displaying tutorial information and guidance to users.
   */
  const openLearningModal = (title: string, description: string) => {
    setModalContent({ title, description });
    setIsModalOpen(true);
    // console.log('HomescreenV3.tsx 3015 › Learning modal opened:', title);
  };

  /**
   * @function closeLearningModal
   * @description
   *   Closes the learning modal and clears the modal content state to
   *   reset the interface for subsequent modal interactions.
   */
  const closeLearningModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    // console.log('HomescreenV3.tsx 3016 › Learning modal closed');
  };

  // Step 5: Filter files based on active tab and search query
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
        // For now, show empty array - favorites functionality can be added later
        files = [];
        break;
      default:
        files = ownedFiles;
    }

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      files = files.filter(file => 
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // console.log('HomescreenV3.tsx 3017 › Filtered files count:', files.length, 'for tab:', activeTab);
    return files;
  };


  /**
   * @function formatFileTime
   * @description
   *   Formats file timestamps into human-readable relative time strings
   *   for improved user experience and temporal context awareness.
   */
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

  // Step 6: Learning topics configuration
  const learningTopics = [
    {
      title: 'Creating a New Document',
      description: 'Learn how to create a new concept map from scratch and explore its features.',
    },
    {
      title: 'Navigating the Map',
      description: 'Understand how to move around the canvas, zoom, and center your concept map.',
    },
    {
      title: 'How to upload and view your personal documents',
      description: 'Discover how to upload your files and view them directly within your workspace.',
    },
    {
      title: 'Chat with your personal AI tutor',
      description: 'Explore interactive sessions with our AI tutor for personalized guidance and support.',
    },
  ];

  // console.log('HomescreenV3.tsx 3018 › Rendering component with filtered files:', getFilteredFiles().length);

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
                <div className="action-tile" onClick={onCreateNewDocument}>
                  <Book className="action-icon" />
                  <div className="action-title">New Notebook</div>
                  <div className="action-desc">Create fresh notes</div>
                </div>
              {/* update - 1: wire calendar quick action to open CalendarModal */}
    <div className="action-tile" onClick={openCalendarModal}>
      <Calendar className="action-icon" />
      <div className="action-title">View Study Planner</div>
      <div className="action-desc">Organize schedule</div>
    </div>
                <div className="action-tile" onClick={onCreateNewDocument}>
                  <Sparkles className="action-icon" />
                  <div className="action-title">Generate Lesson</div>
                  <div className="action-desc">AI-powered creation</div>
                </div>
                <div className="action-tile">
                  <Users className="action-icon" />
                  <div className="action-title">Start Study Group</div>
                  <div className="action-desc">Collaborate</div>
                </div>
              </div>
            </div>

            {/* Files Section Card - Fixed Height with Internal Scrolling */}
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
                        onClick={() => {
                          const meta = buildPickerMeta(file);
                          // console.log('HomescreenV3.tsx 3019 › File tile clicked:', meta);
                          onFileSelect(meta);
                        }}
                      >
                        <div 
  className="file-header" 
  style={{backgroundColor: file.colorCode || '#C8E6C9'}}
></div>
                        <div className="file-title">{file.fileName}</div>
                        <div className="file-meta">
                          <span className="file-time">{formatFileTime(file.updatedAt)}</span>
                
                        </div>
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
                <div className="check-icon">✓</div>
                <div>
                  <div><strong>Get Started</strong></div>
                  <div style={{fontSize: '11px', color: '#6C757D'}}>Create a new document</div>
                </div>
              </div>
              <div className="checklist-item">
                <div className="check-icon">✓</div>
                <div>
                  <div><strong>Upload files</strong></div>
                  <div style={{fontSize: '11px', color: '#6C757D'}}>Import your materials</div>
                </div>
              </div>
              <div className="checklist-item">
                <div className="check-icon">3</div>
                <div>
                  <div><strong>Learn with tutorials</strong></div>
                  <div style={{fontSize: '11px', color: '#6C757D'}}>Master the features</div>
                </div>
              </div>
            </div>

            <div className="assistant-card">
              <h3 className="panel-title">Suggestions</h3>
              <div className="suggestion-item">
                <div><strong>Plan Your Workflow</strong></div>
                <div style={{fontSize: '11px', color: '#6C757D'}}>Set up study schedules</div>
              </div>
              <div className="suggestion-item">
                <div><strong>Explore Recent Files</strong></div>
                <div style={{fontSize: '11px', color: '#6C757D'}}>Continue where you left off</div>
              </div>
            </div>

            <div className="assistant-card">
              <h3 className="panel-title">Learn</h3>
              <div 
                className="learn-card-content"
                onClick={() => openLearningModal(
                  'Create a Study Planner',
                  'Learn how to organize and schedule your study sessions effectively'
                )}
              >
                <div className="learn-title">Create a Study Planner</div>
                <div className="learn-desc">Learn how to organize and schedule your study sessions effectively</div>
              </div>
              {learningTopics.slice(0, 3).map((topic, i) => (
                <div 
                  key={i}
                  className="suggestion-item"
                  onClick={() => openLearningModal(topic.title, topic.description)}
                  style={{marginTop: '8px'}}
                >
                  <div><strong>{topic.title}</strong></div>
                  <div style={{fontSize: '11px', color: '#6C757D'}}>{topic.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Learning Modal */}
      {isModalOpen && modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="modal-content">
            <h3 className="modal-title">{modalContent.title}</h3>
            <p className="modal-description">{modalContent.description}</p>
            <button
              onClick={closeLearningModal}
              className="modal-button"
            >
              Close
            </button>
          </div>
        </div>
      )}


      {/* Calendar Modal Portal (mirrors CanvasView pattern) */}
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