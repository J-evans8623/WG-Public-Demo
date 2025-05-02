/***************************************************************************************
 * @file HomeScreen.tsx
 * @description
 *   This file contains the HomeScreen component which serves as the main landing page
 *   of the BloomMap application. In addition to the existing features, this update:
 *     - Adds a delete button (trash icon) on each recent file tile.
 *     - Implements a handler to delete the file from Firebase via the new API endpoint.
 *     - Refreshes the recent files list upon successful deletion.
 *
 * Responsibilities:
 *   - Render the home screen with quick action tiles, recent files, favorites, and learning sections.
 *   - Allow users to create new documents, select existing files, and delete files.
 *
 * @author 
 * @date 
 ***************************************************************************************/
import React, { useState, useEffect, useContext, useRef } from 'react';
import { ApiContext, DriveFile } from '@/app/src/context/ApiContext';
import { Plus, FileText, Clock, Star, Trash } from 'lucide-react';

/**
 * @interface HomeScreenProps
 * @description Props for the HomeScreen component.
 * @property onFileSelect - Callback to handle loading a file into the editor.
 * @property onCreateNewDocument - Callback to handle creating a new document and navigating to the map view.
 */
interface HomeScreenProps {
  onFileSelect: (fileStoragePath: string) => void;
  onCreateNewDocument: () => void;
}

/**
 * @function HomeScreen
 * @description
 *   Renders the main landing page of the application, including:
 *     - A greeting message
 *     - Quick action tiles for new document creation, favorites, and learning
 *     - A list of recent files with an option to delete each file
 *     - Sections for Favorites and Learning resources
 */
const HomeScreen: React.FC<HomeScreenProps> = ({ onFileSelect, onCreateNewDocument }) => {
  const { listFiles, deleteFile } = useContext(ApiContext);
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  // Refs for scrolling to sections
  const favoritesSectionRef = useRef<HTMLDivElement>(null);
  const learningSectionRef = useRef<HTMLDivElement>(null);

  // Modal state for learning tiles
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; description: string } | null>(null);

  /**
   * @function scrollToSection
   * @description Smoothly scrolls the viewport to the specified section.
   */
  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good morning';
      if (hour < 18) return 'Good afternoon';
      return 'Good evening';
    };
    setGreeting(getGreeting());
    fetchRecentFiles();
  }, []);

  /**
   * @function fetchRecentFiles
   * @description Fetches recent files from the API.
   */
  const fetchRecentFiles = async () => {
    try {
      const files = await listFiles('');
      setRecentFiles(files);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * @function handleDeleteFile
   * @description Confirms and deletes a file using the API, then refreshes the file list.
   * @param fileStoragePath - The Firebase storage path of the file to be deleted.
   */
  const handleDeleteFile = async (fileStoragePath: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteFile(fileStoragePath);
        // Refresh recent files list after deletion.
        fetchRecentFiles();
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  /**
   * @function openLearningModal
   * @description Opens a modal with the specified learning content.
   */
  const openLearningModal = (title: string, description: string) => {
    setModalContent({ title, description });
    setIsModalOpen(true);
  };

  /**
   * @function closeLearningModal
   * @description Closes the learning modal.
   */
  const closeLearningModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  /**
   * @constant learningTopics
   * @description List of learning topics to be displayed in the learning section.
   */
  const learningTopics = [
    {
      title: 'Creating a New Document',
      description: 'Learn how to create a new concept map from scratch and explore its features.'
    },
    {
      title: 'Navigating the Map',
      description: 'Understand how to move around the canvas, zoom, and center your concept map.'
    },
    {
      title: 'How to upload and view your personal documents',
      description: 'Discover how to upload your files and view them directly within your workspace.'
    },
    {
      title: 'Chat with your personal AI tutor',
      description: 'Explore interactive sessions with our AI tutor for personalized guidance and support.'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">{greeting}</h1>
        <p className="text-gray-600">Welcome to your BloomMap workspace</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* New Document Card */}
        <div
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
          onClick={onCreateNewDocument}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">New Document</h3>
              <p className="text-sm text-gray-600">Create a new concept map</p>
            </div>
          </div>
        </div>

        {/* Favorites Card */}
        <div
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
          onClick={() => scrollToSection(favoritesSectionRef)}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold">Favorites</h3>
              <p className="text-sm text-gray-600">View your pinned files</p>
            </div>
          </div>
        </div>

        {/* Learn Card */}
        <div
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
          onClick={() => scrollToSection(learningSectionRef)}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold">Learn</h3>
              <p className="text-sm text-gray-600">Get tutorials and guidance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Files Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Files
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading your files...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentFiles.slice(0, 6).map((file: DriveFile) => (
              <div
                key={file.fileId}
                className="relative bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-4"
                onClick={() => onFileSelect(file.fileStoragePath)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1 truncate">{file.name}</h3>
                    <p className="text-xs text-gray-500">
                      Modified:{' '}
                      {file.timestamp
                        ? new Date(file.timestamp).toLocaleDateString()
                        : 'Unknown date'}
                    </p>
                  </div>
                </div>
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.fileStoragePath);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-100"
                  title="Delete File"
                >
                  <Trash className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Favorites Section */}
      <div ref={favoritesSectionRef} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Favorites</h2>
        <div className="bg-white rounded-lg shadow p-4 text-gray-600">
          <p>You currently have no pinned files.</p>
        </div>
      </div>

      {/* Learning Section */}
      <div ref={learningSectionRef} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Learning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {learningTopics.map((topic, index) => (
            <div
              key={index}
              onClick={() => openLearningModal(topic.title, topic.description)}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              <h3 className="font-semibold text-base mb-2">{topic.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3">{topic.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Learning Modal */}
      {isModalOpen && modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{modalContent.title}</h3>
            <p className="text-gray-700 mb-6">{modalContent.description}</p>
            <button
              onClick={closeLearningModal}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;
