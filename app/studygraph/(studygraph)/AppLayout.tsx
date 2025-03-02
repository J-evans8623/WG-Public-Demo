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
import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext';
//import { WebSocketManagerProvider } from '@/app/Library/Context/WebSocketManager';
import { FileAssetProvider } from '@/app/Library/Context/FileAssetContext';
import AuthPromptModal from '@/app/Library/components/Modals/auth/AuthPromptModal';
import HomeScreen from './components/HomeScreen';
import { Sidebar } from './components/layout/Sidebar/Sidebar';
import ResourcePanel from './components/layout/ResourcePanel/ResourcePanel';
import { CardDisplay } from './components/layout/CardDisplay/CardDisplay';
import { CanvasView } from './components/layout/Canvas/CanvasView';
import './appLayout.css';
import { initializeNewDocument, loadDocumentFromDrive } from '@/app/Library/utils/LoadDocumentUtils';
import { LessonModuleProvider } from '@/app/Library/Context/LessonModuleContext';
import { AutoSaveManager } from '@/app/Library/utils/AutoSaveManager';
import { prepareBloomDocx } from '@/app/Library/utils/documentUtils';
import { useLessonModuleMapper } from '@/app/studygraph/(studygraph)/components/hooks/useLessonModuleMapper';
import { UserInfoPanel } from '@/app/studygraph/(studygraph)/components/layout/UserInfoPanel';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const AppLayoutContent = () => {
  // ----- View and UI state -----
  const [currentView, setCurrentView] = useState<'home' | 'map' | 'user'>('home');
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  const [isDirectoryVisible, setIsDirectoryVisible] = useState(true);
  const [resourcePanelWidth, setResourcePanelWidth] = useState(225);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cardDisplayWidth, setCardDisplayWidth] = useState(288);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);

  // ----- Contexts -----
  const { isAuthenticated, loadFromDrive, autosaveDocument } = useContext(ApiContext);
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: colorThemeDispatch, colorTheme, primaryColor, backgroundColor } =
    useColorThemeContext();
  const {
    createNewDocument,
    persistDoc,
    getFileName,
    driveFileId,
    updateDriveId,
    loadData,
    getLessonModuleJSON,
    ydoc,
  } = useYDoc();

  // Ref for ensuring one-time initialization when entering map view.
  const hasInitialized = useRef(false);
  // Ref for the viewport (map container).
  const viewportRef = useRef<HTMLDivElement>(null);

  // ----- Autosave state -----
  const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');

  // ----- Window Resize Handler -----
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = window.innerWidth * 0.4;
      if (cardDisplayWidth > maxWidth) {
        setCardDisplayWidth(maxWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardDisplayWidth]);

  // ----- Document Initialization for Map View -----
  useEffect(() => {
    const initializeApp = async () => {
      if (currentView === 'map') {
        try {
          await initializeNewDocument(createNewDocument, layoutDispatch, colorThemeDispatch);
          // Center the map after initialization.
          if (viewportRef.current) {
            const centerEvent = new CustomEvent('centerMap');
            viewportRef.current.dispatchEvent(centerEvent);
          }
        } catch (error) {
          console.error('Error initializing map:', error);
        }
      }
    };
    if (!hasInitialized.current && currentView === 'map') {
      hasInitialized.current = true;
      initializeApp();
    }
  }, [currentView, createNewDocument, layoutDispatch, colorThemeDispatch]);

  // ----- Autosave Manager Setup -----
  useEffect(() => {
    // Only instantiate autosave if in map view and user is authenticated.
    if (currentView === 'map' && isAuthenticated) {
      // Define the autosave callback with detailed steps.
      const autosaveCallback = async () => {
        setSaveStatus('saving');
        const fileName = getFileName();
        try {
          const bloomDocx = await prepareBloomDocx(
            persistDoc,
            colorTheme,
            primaryColor,
            backgroundColor,
            fileName,
            driveFileId,
            getLessonModuleJSON
          );
          const arrayBuffer = await bloomDocx.arrayBuffer();
          const newFileId = await autosaveDocument(arrayBuffer, fileName, driveFileId);
          updateDriveId(newFileId);
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
  }, [
    currentView,
    isAuthenticated,
    ydoc,
    persistDoc,
    colorTheme,
    primaryColor,
    backgroundColor,
    driveFileId,
    getLessonModuleJSON,
    autosaveDocument,
    updateDriveId,
    getFileName,
  ]);

  useLessonModuleMapper();

  // ----- File Loading from HomeScreen -----
  const handleFileSelect = async (fileId: string) => {
    try {
      const arrayBuffer = await loadFromDrive(fileId);
      const loadedFileName = `${fileId}.bloomdocx`;
      const file = new File([arrayBuffer], loadedFileName, {
        type: 'application/octet-stream',
      });
      await loadDocumentFromDrive(file, loadData, fileId, colorThemeDispatch);
      setCurrentView('map');
      if (viewportRef.current) {
        const centerEvent = new CustomEvent('centerMap');
        viewportRef.current.dispatchEvent(centerEvent);
      }
    } catch (error) {
      console.error('Error loading file from drive:', error);
    }
  };

  // ----- Render Section -----
  return (
    <div className={`h-screen w-full flex prevent-select ${isDirectoryVisible ? 'bg-white' : 'bg-gray-100'}`}>
      {!isAuthenticated && (
        <AuthPromptModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      )}

      {/* Sidebar in normal flow, not fixed */}
      <Sidebar
        isDashboardExpanded={isDashboardExpanded}
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onMouseEnter={() => setIsDashboardExpanded(true)}
        onMouseLeave={() => setIsDashboardExpanded(false)}
      />

      <div className="flex-1 flex">
        {/* Home Screen view */}
        {currentView === 'home' && <HomeScreen onFileSelect={handleFileSelect} />}

        {/* Map/Canvas view */}
        {currentView === 'map' && (
          <div className="flex-1 flex">
            {isDirectoryVisible && (
              <ResourcePanel
                width={resourcePanelWidth}
                isDragging={isDragging}
                dragOffset={dragOffset}
                onDragStart={() => {
                  setIsDragging(true);
                  setDragOffset(0);
                }}
                onDrag={(dx) => {
                  setDragOffset(dx);
                  if (dx < -50) {
                    setIsDirectoryVisible(false);
                    setIsDragging(false);
                    setDragOffset(0);
                  }
                }}
                onDragEnd={() => {
                  setIsDragging(false);
                  setDragOffset(0);
                }}
                isExpanded={isDirectoryVisible}
              />
            )}

            <CanvasView
              viewportRef={viewportRef}
              isResourcePanelVisible={isDirectoryVisible}
              onToggleResourcePanel={() => setIsDirectoryVisible(!isDirectoryVisible)}
              autosaveStatus={saveStatus}
            />

            <CardDisplay
              width={cardDisplayWidth}
              isEditMode={isEditMode}
              currentTopicTitle="My Topic" // You can pass the real topic title if needed
              onEditToggle={() => setIsEditMode(!isEditMode)}
              onResize={(dx) => {
                const newWidth = cardDisplayWidth - dx;
                const maxWidth = window.innerWidth * 0.4;
                setCardDisplayWidth(Math.min(Math.max(288, newWidth), maxWidth));
              }}
            />
          </div>
        )}

        {/* User Info view */}
        {currentView === 'user' && (
          <div className="flex-1">
            <UserInfoPanel onClose={() => setCurrentView('map')} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Wraps AppLayoutContent with all the necessary context providers.
 */
export const AppLayout = () => {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ApiProvider>
        <YDocProvider>
        <ViewSwitchProvider>
          <LessonModuleProvider>
            <FileAssetProvider>
              <NodeSelectionProvider>
                <ResourceProvider>
                  {/*<WebSocketManagerProvider>**/}
                    <NodesProvider>
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
                    </NodesProvider>
                  {/*</WebSocketManagerProvider>* */}
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
