/**
 * @file AppLayout.tsx
 * @description
 * This is the top-level layout for the entire application. It wraps the application with all necessary context providers
 * (including authentication, document, layout, zoom, etc.) and controls the high-level view switching between "home", "map",
 * and "user" screens.
 *
 * IMPORTANT:
 * - The autosave mechanism is integrated into the "map" view. The autosave callback now calls the new Firebase Storage
 *   pipeline by using YDocContext's saveToFirebase method instead of the legacy Google Drive upload.
 * - When a user is on the "map" view and authenticated, the AutoSaveManager is instantiated with the new autosave callback.
 *
 * Responsibilities:
 * - Manage view state and context provider composition.
 * - Initialize a new document on mount if none exists.
 * - Set up autosave using the new Firebase-based persistence pipeline.
 * - Load documents from Firebase Storage when a file tile is clicked.
 */

'use client';

import React, { useState, useEffect, useContext, useRef } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ApiProvider, ApiContext } from '@/app/src/context/ApiContext';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { NodesProvider } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider } from '@/app/Library/Context/ZoomProvider';
import { ViewSwitchProvider } from '@/app/Library/Context/ViewSwitchContext';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { ResourceProvider } from '@/app/Library/Context/ResourceContext';
import { LessonDataProvider } from '@/app/Library/Context/LessonDataContext';
import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext';
import { FileAssetProvider } from '@/app/Library/Context/FileAssetContext';

//import AuthPromptModal from '@/app/Library/components/Modals/auth/AuthPromptModal';
import HomeScreen from './components/HomeScreen';
import NavigationPanel from '@/app/studygraph/(studygraph)/components/layout/Sidebar/NavigationPanel';
import { CardDisplay } from './components/layout/CardDisplay/CardDisplay';
import { CanvasView } from './components/layout/Canvas/CanvasView';
import { UserInfoPanel } from '@/app/studygraph/(studygraph)/components/layout/UserInfoPanel';

import './appLayout.css';

import { initializeNewDocument } from '@/app/Library/utils/LoadDocumentUtils';
import { LessonModuleProvider } from '@/app/Library/Context/LessonModuleContext';
import { AutoSaveManager } from '@/app/Library/utils/AutoSaveManager';
import { useLessonModuleMapper } from '@/app/studygraph/(studygraph)/components/hooks/useLessonModuleMapper';

import { Menu, ChevronsLeft } from 'lucide-react';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

/**
 * @function AppLayoutContent
 * @description
 * Manages the high-level screens: 'home', 'map', 'user'. Always renders the NavigationPanel so that hovering on the
 * left edge (or clicking the top-left menu icon) will reveal it. If the user is not authenticated, an AuthPromptModal
 * is displayed.
 *
 * Key Steps:
 * 1. Maintain and manage the current top-level view.
 * 2. Initialize a new document on mount if none exists.
 * 3. Set up autosave when on the 'map' view and when the user is authenticated (using Firebase Storage).
 * 4. Provide functions to load files and create new documents.
 */
const AppLayoutContent: React.FC = () => {
  // Application-level screen states.
  const [currentView, setCurrentView] = useState<'home' | 'map' | 'user'>('home');

  // Sidebar states (manual toggle and expansion tracking).
  const [isPanelManuallyOpen, setIsPanelManuallyOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Other UI states.
  const [cardDisplayWidth, setCardDisplayWidth] = useState(325);
  const [isEditMode, setIsEditMode] = useState(false);
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: colorThemeDispatch } = useColorThemeContext();
  const {
    createNewDocument,
    docFileID,
    saveToFirebase,
    loadFromFirebase,
    ydoc
  } = useYDoc();

  // Refs.
  const hasInitialized = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Autosave: using AutoSaveManager.
  const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');

  // Lesson module mapping hook.
  useLessonModuleMapper();

  /**
   * @function handleResize
   * @description Restricts the CardDisplay panel width to a maximum of 40% of the window width.
   */
  useEffect(() => {
    function handleResize() {
      const maxWidth = window.innerWidth * 0.4;
      if (cardDisplayWidth > maxWidth) {
        setCardDisplayWidth(maxWidth);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardDisplayWidth]);

  /**
   * @function initializeAppOnMount
   * @description Creates a new document on mount if none exists, then centers the map.
   */
  useEffect(() => {
    async function initializeApp() {
      try {
        await initializeNewDocument(createNewDocument, layoutDispatch, colorThemeDispatch);
        if (viewportRef.current) {
          const centerEvent = new CustomEvent('centerMap');
          viewportRef.current.dispatchEvent(centerEvent);
        }
      } catch (error) {
        console.error('Error initializing document on mount:', error);
      }
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!docFileID) {
        initializeApp();
      }
    }
  }, [docFileID, createNewDocument, layoutDispatch, colorThemeDispatch]);

  /**
   * @function setupAutosave
   * @description Sets up autosave when on the 'map' view and authenticated, using saveToFirebase.
   */
  useEffect(() => {
    if (currentView === 'map') {
      const autosaveCallback = async () => {
        setSaveStatus('saving');
        try {
          await saveToFirebase();
          setSaveStatus('saved');
        } catch (error) {
          console.error('Autosave error:', error);
        }
      };

      if (!autoSaveManagerRef.current) {
        autoSaveManagerRef.current = new AutoSaveManager(ydoc, autosaveCallback);
      }
    }
    return () => {
      if (autoSaveManagerRef.current) {
        autoSaveManagerRef.current.destroy();
        autoSaveManagerRef.current = null;
      }
    };
  }, [currentView, ydoc, saveToFirebase]);

  /**
   * @function handleFileSelect
   * @description
   * Loads a file from Firebase Storage using the loadFromFirebase method provided by YDocContext.
   * This method is invoked when a file tile (from the Recent Files section) is clicked.
   * It updates the document state and navigates the app to the 'map' view.
   *
   * @param {string} fileStorageId - The Firebase Storage identifier for the file.
   */
  const handleFileSelect = async (fileStorageId: string) => {
    try {
      // Load the document state from Firebase Storage using loadFromFirebase.
      await loadFromFirebase(fileStorageId);
      setCurrentView('map');
      if (viewportRef.current) {
        const centerEvent = new CustomEvent('centerMap');
        viewportRef.current.dispatchEvent(centerEvent);
      }
    } catch (error) {
      console.error('Error loading document from Firebase Storage:', error);
    }
  };

  /**
   * @function handleCreateNewDocument
   * @description Creates a new document using createNewDocument and navigates to the 'map' view.
   */
  const handleCreateNewDocument = async () => {
    try {
      await createNewDocument();
      setCurrentView('map');
      if (viewportRef.current) {
        const centerEvent = new CustomEvent('centerMap');
        viewportRef.current.dispatchEvent(centerEvent);
      }
    } catch (error) {
      console.error('Error creating new document:', error);
    }
  };

  /**
   * @function handleTogglePanel
   * @description Toggles the navigation panel's open/closed state.
   */
  const handleTogglePanel = () => {
    setIsPanelManuallyOpen((prev) => !prev);
  };

  /**
   * @function renderMenuIcon
   * @description Renders the appropriate menu icon based on whether the panel is expanded.
   * @returns {JSX.Element} The menu icon.
   */
  const renderMenuIcon = () => {
    return isPanelExpanded ? <ChevronsLeft className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="h-screen w-full flex bg-white">
      {/* Display AuthPromptModal if the user is not authenticated */}

      {/* Navigation Panel */}
      <div className="z-50">
        <NavigationPanel
          isManuallyOpen={isPanelManuallyOpen}
          currentView={currentView}
          onSetView={setCurrentView}
          onExpandedChange={setIsPanelExpanded}
        />
      </div>

      {/* Toggle button for Navigation Panel */}
      <button
        onClick={handleTogglePanel}
        className="absolute top-4 left-4 z-50 p-2 bg-gray-100 rounded shadow hover:bg-gray-200 transition-colors"
        title="Toggle Navigation Panel"
        data-testid="nav-toggle-button"
      >
        {renderMenuIcon()}
      </button>

      {/* Screen rendering based on current view */}
      {currentView === 'home' && (
        <div className="flex-1">
          <HomeScreen onFileSelect={handleFileSelect} onCreateNewDocument={handleCreateNewDocument} />
        </div>
      )}
      {currentView === 'map' && (
        <div className="flex-1 flex">
          <CanvasView
            isResourcePanelVisible
            onToggleResourcePanel={() => {}}
            autosaveStatus={saveStatus}
          />
          <CardDisplay
            width={cardDisplayWidth}
            isEditMode={isEditMode}
            currentTopicTitle="My Topic"
            onEditToggle={() => setIsEditMode(!isEditMode)}
            onResize={(dx) => {
              const newWidth = cardDisplayWidth - dx;
              const maxWidth = window.innerWidth * 0.4;
              setCardDisplayWidth(Math.min(Math.max(288, newWidth), maxWidth));
            }}
          />
        </div>
      )}
      {currentView === 'user' && (
        <div className="flex-1">
          <UserInfoPanel onClose={() => setCurrentView('map')} />
        </div>
      )}
    </div>
  );
};

/**
 * @function AppLayout
 * @description Wraps AppLayoutContent with all required context providers.
 * Provides production-ready integration of authentication, document management,
 * and Firebase Storage based file persistence.
 * 
 * @returns {JSX.Element} The complete application layout.
 */
export const AppLayout: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ApiProvider>
        <YDocProvider>
          <ViewSwitchProvider>
            <LessonModuleProvider>
              <FileAssetProvider>
                <NodeSelectionProvider>
                  <ResourceProvider>
                    <NodesProvider>
                      <LessonDataProvider>
                        <ZoomProvider>
                          <LayoutProvider>
                            <ColorThemeProvider>
                              <SubTreeProvider>
                                <AppLayoutContent />
                                <div id="modal-root" />
                              </SubTreeProvider>
                            </ColorThemeProvider>
                          </LayoutProvider>
                        </ZoomProvider>
                      </LessonDataProvider>
                    </NodesProvider>
                  </ResourceProvider>
                </NodeSelectionProvider>
              </FileAssetProvider>
            </LessonModuleProvider>
          </ViewSwitchProvider>
        </YDocProvider>
      </ApiProvider>
    </GoogleOAuthProvider>
  );
};

export default AppLayout;
