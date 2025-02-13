'use client';

import React, { useState, useEffect, useContext, useRef } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ApiProvider, ApiContext } from '@/app/src/context/ApiContext';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { NodesProvider, useNodesContext } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider } from '@/app/Library/Context/ZoomProvider';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { ResourceProvider } from '@/app/Library/Context/ResourceContext';
import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext';
import { WebSocketManagerProvider } from '@/app/Library/Context/WebSocketManager';
import { FileAssetProvider } from '@/app/Library/Context/FileAssetContext';
import AuthPromptModal from '@/app/Library/components/Modals/auth/AuthPromptModal';
import HomeScreen from './components/HomeScreen';
import { Sidebar } from './components/layout/Sidebar/Sidebar';
import { ResourcePanel } from './components/layout/ResourcePanel/ResourcePanel';
import { CardDisplay } from './components/layout/CardDisplay/CardDisplay';
import { CanvasView } from './components/layout/Canvas/CanvasView';
import './appLayout.css';
import { initializeNewDocument } from '@/app/Library/utils/LoadDocumentUtils'; 

//–––
// Note: The following state values are now in “px” (after scaling).
// 256px becomes 192px and 384px becomes 288px.
const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const AppLayoutContent = () => {
  // Sidebar state
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'map'>('home');

  // Resource panel state (192px = 12rem)
  const [isDirectoryVisible, setIsDirectoryVisible] = useState(true);
  const [resourcePanelWidth, setResourcePanelWidth] = useState(192);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Card display state (288px = 18rem)
  const [isEditMode, setIsEditMode] = useState(false);
  const [cardDisplayWidth, setCardDisplayWidth] = useState(288);

  // Auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const { isAuthenticated } = useContext(ApiContext);

  // Initialization values
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: colorThemeDispatch } = useColorThemeContext();
  const { createNewDocument } = useYDoc();
  const hasInitialized = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const initializeApp = async () => {
      if (currentView === 'map') {
        try {
          await initializeNewDocument(
            createNewDocument,
            layoutDispatch,
            colorThemeDispatch
          );
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
  
  const handleResourcePanelDrag = (dx: number) => {
    setDragOffset(dx);
    if (dx < -50) {
      setIsDirectoryVisible(false);
      setIsDragging(false);
      setDragOffset(0);
    }
  };

  const handleCardDisplayResize = (dx: number) => {
    const newWidth = cardDisplayWidth - dx;
    const maxWidth = window.innerWidth * 0.4;
    setCardDisplayWidth(Math.min(Math.max(288, newWidth), maxWidth));
  };

  return (
   // In AppLayoutContent, update the root container div:
<div className={`h-screen w-full flex prevent-select ${isDirectoryVisible ? 'bg-white' : 'bg-gray-100'}`}>
      {!isAuthenticated && (
        <AuthPromptModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      <Sidebar 
        isDashboardExpanded={isDashboardExpanded}
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onMouseEnter={() => setIsDashboardExpanded(true)}
        onMouseLeave={() => setIsDashboardExpanded(false)}
      />

      <div className={`flex-1 flex transition-all duration-300 ${isDashboardExpanded ? 'ml-64' : 'ml-16'}`}>
        {/* Home Screen */}
        <div className={`flex-1 ${currentView === 'home' ? 'block' : 'hidden'}`}>
          <HomeScreen />
        </div>

        {/* Map/Canvas View */}
        <div className={`flex-1 flex ${currentView === 'map' ? '' : 'hidden'}`}>
          {isDirectoryVisible && (
            <ResourcePanel
              width={resourcePanelWidth}
              isDragging={isDragging}
              dragOffset={dragOffset}
              onDragStart={() => {
                setIsDragging(true);
                setDragOffset(0);
              }}
              onDrag={handleResourcePanelDrag}
              onDragEnd={() => {
                setIsDragging(false);
                setDragOffset(0);
              }}
            />
          )}

          <CanvasView 
            viewportRef={viewportRef}
            isResourcePanelVisible={isDirectoryVisible}
            onToggleResourcePanel={() => setIsDirectoryVisible(!isDirectoryVisible)}
          />

          <CardDisplay
            width={cardDisplayWidth}
            isEditMode={isEditMode}
            onEditToggle={() => setIsEditMode(!isEditMode)}
            onResize={handleCardDisplayResize}
          />
        </div>
      </div>
    </div>
  );
};

export const AppLayout = () => {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ApiProvider>
        <YDocProvider>
          <FileAssetProvider>
            <NodeSelectionProvider>
              <ResourceProvider>
                <WebSocketManagerProvider>
                  <NodesProvider>
                    <ZoomProvider>
                      <LayoutProvider>
                        <ColorThemeProvider>
                          <SubTreeProvider>
                            <AppLayoutContent />
                          </SubTreeProvider>
                        </ColorThemeProvider>
                      </LayoutProvider>
                    </ZoomProvider>
                  </NodesProvider>
                </WebSocketManagerProvider>
              </ResourceProvider>
            </NodeSelectionProvider>
          </FileAssetProvider>
        </YDocProvider>
      </ApiProvider>
    </GoogleOAuthProvider>
  );
};
