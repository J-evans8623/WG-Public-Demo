/***************************************************************************************
 * @file HomeScreenV2.tsx
 * @description
 *   The HomeScreenV2 component serves as the primary landing interface of the BloomMap application,
 *   responsible for greeting the user, presenting quick actions such as creating new concept maps,
 *   and providing multiple file management sections (Recent Files, Files Shared With Me, Favorites,
 *   and Learning tutorials). This file orchestrates stateful data fetching via ApiContext hooks,
 *   processes deletion flows with user confirmations, and controls modal displays for tutorial content.
 *   In this extension, the fixed six‐item Recent Files grid has been replaced with a horizontal
 *   scrolling strip named 'recent-files-strip', enabling users to view and access all their owned files
 *   in a single, scrollable row. Diagnostic console.log statements with unique identifiers have been
 *   added at key execution points for observability, while existing responsive and stylistic behaviors
 *   have been preserved without impacting other file sections or API logic.
 ***************************************************************************************/
import React, { useState, useEffect, useContext, useRef } from 'react';
import { ApiContext } from '@/app/src/context/ApiContext';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { Plus, FileText, Clock, Star, Trash } from 'lucide-react';
import './HomeScreen.css';
import { Role } from '../types/access';
import DocumentAccessManager from './hooks/access/DocumentAccessManager';

/**
 * @type PickerFileMeta
 * @description
 *   Payload emitted to the parent on tile click. The parent uses this to update
 *   AccessLayer synchronously and then load the file’s bytes. `updatedAt` prefers
 *   ISO strings to align with AccessLayer’s newest-wins logic.
 */
export type PickerFileMeta = {
  docId: string;
  fileStorageId?: string;
  fileName: string;
  role?: Role;
  updatedAt?: string;
};



interface HomeScreenProps {
  onFileSelect: (payload: PickerFileMeta | string) => void;
  onCreateNewDocument: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onFileSelect,
  onCreateNewDocument,
}) => {
  const { listFiles, deleteFile } = useContext(ApiContext);
  const [ownedFiles, setOwnedFiles] = useState<UserFileMetadata[]>([]);
  const [sharedFiles, setSharedFiles] = useState<UserFileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  const favoritesSectionRef = useRef<HTMLDivElement>(null);
  const learningSectionRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    description: string;
  } | null>(null);

  /**
   * Step 1: Scrolls smoothly to the given section reference when a Quick Action is clicked.
   */
  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Step 2: Set greeting based on time of day and initiate file fetch
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' :
      'Good evening'
    );
    fetchFiles();
  }, []);

  /**
   * Step 3: Fetches both owned and shared files from the API context.
   * Logs entry and exit points with file counts for debugging.
   */
  const fetchFiles = async () => {
    console.log('HomeScreenV2.tsx 1001 › fetchFiles start');
    try {
      const { ownedFiles, sharedFiles } = await listFiles();
      console.log(
        'HomeScreenV2.tsx 1002 › fetched ownedFiles count:',
        ownedFiles.length
      );
      console.log(
        'HomeScreenV2.tsx 1003 › fetched sharedFiles count:',
        sharedFiles.length
      );

      // Step 1: Sync access records with DocumentAccessManager
    const manager = DocumentAccessManager.getInstance();
    manager.syncFileList([...ownedFiles, ...sharedFiles]);
    console.log('HomeScreenV2.tsx 1004 › Access records synchronized');

    
      setOwnedFiles(ownedFiles);
      setSharedFiles(sharedFiles);
    } catch (err) {
      console.error('HomeScreenV2.tsx 1004 › fetchFiles error', err);
    } finally {
      setLoading(false);
      console.log('HomeScreenV2.tsx 1005 › fetchFiles end, loading=false');
    }
  };

  /**
   * Step 4: Prompts confirmation then deletes the specified file and refetches the list.
   */
  const handleDeleteFile = async (path: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      console.log(
        'HomeScreenV2.tsx 1006 › deleteFile confirmed for path:',
        path
      );
      try {
        await deleteFile(path);
        console.log('HomeScreenV2.tsx 1007 › deleteFile succeeded:', path);
        fetchFiles();
      } catch (err) {
        console.error('HomeScreenV2.tsx 1008 › deleteFile error', err);
      }
    }
  };

  /**
   * Step 5: Opens the learning modal with the given title and description.
   */
  const openLearningModal = (title: string, description: string) => {
    setModalContent({ title, description });
    setIsModalOpen(true);
  };

  /**
   * Step 6: Closes the learning modal.
   */
  const closeLearningModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

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

  // Step 7: Log before rendering Recent Files strip
  console.log(
    'HomeScreenV2.tsx 1101 › rendering Recent Files strip with count:',
    ownedFiles.length
  );

/**
   * @function buildPickerMeta
   * @description
   *   Assemble the PickerFileMeta object from UserFileMetadata.
   *   Now uses the proper interface with built-in role information.
   */
  const buildPickerMeta = (file: UserFileMetadata): PickerFileMeta => {
    const meta: PickerFileMeta = {
      docId: file.fileId,
      fileStorageId: file.fileStoragePath,
      fileName: file.fileName,
      role: file.role, // Now directly available from the interface
      updatedAt: file.updatedAt, // Already in ISO format
    };
    
    console.log('HomeScreenV2.tsx 1201 › buildPickerMeta with proper role', meta);
    return meta;
  };

  return (
    <div className="home-screen">
      <main className="main-content">
        {/* Welcome Section */}
        <section className="welcome-section">
          <h1 className="welcome-title">{greeting}</h1>
          <p className="welcome-subtitle">Welcome to your BloomMap workspace</p>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <div className="action-card" onClick={onCreateNewDocument}>
            <div className="action-icon new-doc-icon">
              <Plus />
            </div>
            <h3 className="action-title">New Document</h3>
            <p className="action-description">Create a new concept map</p>
          </div>
          <div className="action-card" onClick={() => scrollToSection(favoritesSectionRef)}>
            <div className="action-icon favorites-icon">
              <Star />
            </div>
            <h3 className="action-title">Favorites</h3>
            <p className="action-description">View your pinned files</p>
          </div>
          <div className="action-card" onClick={() => scrollToSection(learningSectionRef)}>
            <div className="action-icon learn-icon">
              <FileText />
            </div>
            <h3 className="action-title">Learn</h3>
            <p className="action-description">Get tutorials and guidance</p>
          </div>
        </section>

     {/* Recent Files (2-Row Horizontally Scrollable) */}
<section className="section">
  <div className="section-header">
    <h2 className="section-title">
      <Clock className="section-icon" />
      Recent Files
    </h2>
  </div>
  {loading ? (
    <div style={{ textAlign: 'center', padding: '2rem' }}>Loading your files...</div>
  ) : ownedFiles.length === 0 ? (
    <div className="empty-state">
      <div className="empty-icon">📄</div>
      <h3 className="empty-title">No recent files</h3>
      <p className="empty-description">Create your first document to get started.</p>
    </div>
  ) : (
    <div className="recent-files-container">
      <div className="recent-files-grid">
        {ownedFiles.map((file) => (
          <div
            key={file.fileId}
            className="file-card"
            onClick={() => {
                      const meta = buildPickerMeta(file);
                      console.log('HomeScreenV2.tsx 1202 › tile click select meta', meta);
                      onFileSelect(meta);
                    }}
          >
            <div className="file-header">
              <div className="file-icon generic-icon">
                <FileText />
              </div>
              <div className="file-info">
                <div className="file-name">{file.fileName}</div>
                <div className="file-meta">
                  Modified:{' '}
                  {file.timestamp
                    ? new Date(file.updatedAt|| '').toLocaleDateString()
                    : 'Unknown date'}
                </div>
              </div>
            </div>
            <div className="file-preview">No preview available.</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(file.fileStoragePath);
              }}
              className="delete-button"
              title="Delete File"
            >
              <Trash className="trash-icon" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )}
</section>
        {/* Files Shared With Me */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              <FileText className="section-icon" />
              Files Shared With Me
            </h2>
          </div>
          {!loading && (
            <div className="files-grid">
              {sharedFiles.map((f) => (
                <div
                  key={f.fileId}
                  className="file-card"
                  onClick={() => {
                      const meta = buildPickerMeta(f);
                      console.log('HomeScreenV2.tsx 1202 › tile click select meta', meta);
                      onFileSelect(meta);
                    }}
                >
                  <div className="file-header">
                    <div className="file-icon generic-icon">
                      <FileText />
                    </div>
                    <div className="file-info">
                      <div className="file-name">{f.fileName}</div>
                      <div className="file-meta">
                        Modified:{' '}
                        {f.timestamp
                          ? new Date(f.updatedAt || '').toLocaleDateString()
                          : 'Unknown date'}
                      </div>
                    </div>
                  </div>
                  <div className="file-preview">No preview available.</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(f.fileStoragePath);
                    }}
                    className="delete-button"
                    title="Delete File"
                  >
                    <Trash className="trash-icon" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Favorites Section */}
        <section ref={favoritesSectionRef} className="section">
          <div className="section-header">
            <h2 className="section-title">
              <Star className="section-icon" />
              Favorites
            </h2>
          </div>
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <h3 className="empty-title">No pinned files</h3>
            <p className="empty-description">You currently have no pinned files.</p>
          </div>
        </section>

        {/* Learning Section */}
        <section ref={learningSectionRef} className="section">
          <div className="section-header">
            <h2 className="section-title">
              <FileText className="section-icon" />
              Learning
            </h2>
          </div>
          <div className="files-grid">
            {learningTopics.map((topic, i) => (
              <div
                key={i}
                className="file-card"
                onClick={() => openLearningModal(topic.title, topic.description)}
              >
                <div className="file-name">{topic.title}</div>
                <div className="file-meta">{topic.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Learning Modal */}
        {isModalOpen && modalContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="file-card" style={{ maxWidth: '400px' }}>
              <h3 className="file-name mb-4">{modalContent.title}</h3>
              <p className="file-meta mb-6">{modalContent.description}</p>
              <button
                onClick={closeLearningModal}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomeScreen;
