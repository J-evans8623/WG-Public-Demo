// HomeScreenV2.tsx
/***************************************************************************************
 * @file HomeScreenV2.tsx
 * @description
 *   Main landing page of the BloomMap application. (Styling has been extracted into
 *   HomeScreen.css; functionality is unchanged.)
 ***************************************************************************************/
import React, { useState, useEffect, useContext, useRef } from 'react';
import { ApiContext, DriveFile } from '@/app/src/context/ApiContext';
import { Plus, FileText, Clock, Star, Trash } from 'lucide-react';
import './HomeScreen.css';

interface HomeScreenProps {
  onFileSelect: (fileStoragePath: string) => void;
  onCreateNewDocument: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onFileSelect,
  onCreateNewDocument,
}) => {
  const { listFiles, deleteFile } = useContext(ApiContext);
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  const favoritesSectionRef = useRef<HTMLDivElement>(null);
  const learningSectionRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning'
      : hour < 18 ? 'Good afternoon'
      : 'Good evening');
    fetchRecentFiles();
  }, []);

  const fetchRecentFiles = async () => {
    try {
      const files = await listFiles('');
      setRecentFiles(files);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteFile(path);
        fetchRecentFiles();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openLearningModal = (title: string, description: string) => {
    setModalContent({ title, description });
    setIsModalOpen(true);
  };
  const closeLearningModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  const learningTopics = [
    {
      title: 'Creating a New Document',
      description:
        'Learn how to create a new concept map from scratch and explore its features.',
    },
    {
      title: 'Navigating the Map',
      description:
        'Understand how to move around the canvas, zoom, and center your concept map.',
    },
    {
      title: 'How to upload and view your personal documents',
      description:
        'Discover how to upload your files and view them directly within your workspace.',
    },
    {
      title: 'Chat with your personal AI tutor',
      description:
        'Explore interactive sessions with our AI tutor for personalized guidance and support.',
    },
  ];

  return (
    <div className="home-screen">
      <main className="main-content">
        <section className="welcome-section">
          <h1 className="welcome-title">{greeting}</h1>
          <p className="welcome-subtitle">
            Welcome to your BloomMap workspace
          </p>
        </section>

        <section className="quick-actions">
          <div className="action-card" onClick={onCreateNewDocument}>
            <div className="action-icon new-doc-icon">
              <Plus />
            </div>
            <h3 className="action-title">New Document</h3>
            <p className="action-description">
              Create a new concept map
            </p>
          </div>

          <div
            className="action-card"
            onClick={() => scrollToSection(favoritesSectionRef)}
          >
            <div className="action-icon favorites-icon">
              <Star />
            </div>
            <h3 className="action-title">Favorites</h3>
            <p className="action-description">View your pinned files</p>
          </div>

          <div
            className="action-card"
            onClick={() => scrollToSection(learningSectionRef)}
          >
            <div className="action-icon learn-icon">
              <FileText />
            </div>
            <h3 className="action-title">Learn</h3>
            <p className="action-description">
              Get tutorials and guidance
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              <Clock className="section-icon" />
              Recent Files
            </h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              Loading your files...
            </div>
          ) : (
            <div className="files-grid">
              {recentFiles.slice(0, 6).map((file) => (
                <div
                  key={file.fileId}
                  className="file-card"
                  onClick={() => onFileSelect(file.fileStoragePath)}
                >
                  <div className="file-header">
                    <div className="file-icon generic-icon">
                      <FileText />
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">
                        Modified:{' '}
                        {file.timestamp
                          ? new Date(file.timestamp).toLocaleDateString()
                          : 'Unknown date'}
                      </div>
                    </div>
                  </div>

                  <div className="file-preview">
                    {/* Assuming you derive a short preview in DriveFile */}
                    { 'No preview available.'}
                  </div>

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
          )}
        </section>

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
            <p className="empty-description">
              You currently have no pinned files.
            </p>
          </div>
        </section>

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
                onClick={() =>
                  openLearningModal(topic.title, topic.description)
                }
              >
                <div className="file-name">{topic.title}</div>
                <div className="file-meta">{topic.description}</div>
              </div>
            ))}
          </div>
        </section>

        {isModalOpen && modalContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="file-card" style={{ maxWidth: '400px' }}>
              <h3 className="file-name mb-4">{modalContent.title}</h3>
              <p className="file-meta mb-6">
                {modalContent.description}
              </p>
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
