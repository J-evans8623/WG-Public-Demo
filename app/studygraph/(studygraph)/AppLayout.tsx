
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
import 'katex/dist/katex.min.css'
import '@/app/studygraph/styles/tokens.css'     
import '@/app/studygraph/styles/brand/brand-utilities.css'  
import '@/app/studygraph/styles/theme-warm-board.css'
import '@/app/studygraph/(studygraph)/canvas/Map/NodeGraphOriginal.css'
import '@/app/studygraph/(studygraph)/components/layout/forum/ForumModal.css'
import '@/app/studygraph/(studygraph)/components/layout/Canvas/CanvasView.css'
import './appLayout.css';
import { documentSession} from '@/app/studygraph/(studygraph)/services/documentSession';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ApiProvider} from '@/app/src/context/ApiContext';
import { NodeSelectionProvider, useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { NodesProvider } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider } from '@/app/Library/Context/ZoomProvider';
import { ViewSwitchProvider, useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { UndoRedoProvider, useUndoRedo } from './components/Context/UndoRedoContext';
import { ResourceProvider } from '@/app/Library/Context/ResourceContext';
import { LessonDataProvider } from '@/app/Library/Context/LessonDataContext';
import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext';
import { FileAssetProvider } from '@/app/Library/Context/FileAssetContext';
import {SelectionAttachmentProvider} from '@/app/Library/Context/SelectionAttachmentContext'
import { VersionHistoryProvider, useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import VersionHistoryPanel from './components/versionHistory/ui/VersionHistoryPanel';
import SelectionAttachmentHandler from './components/layout/Canvas/SelectionAttachmentHandler';
import HomeScreen from './components/HomescreenV3';
import NavigationController from './NavigationController';
import { CanvasView } from './components/layout/Canvas/CanvasView';
import VHcanvasView from './components/layout/ReadOnly/map/VHcanvasView';
import ROcardDisplay from './components/layout/ReadOnly/CardDisplay/VHcardDisplay';
import { UserInfoPanel } from '@/app/studygraph/(studygraph)/components/layout/UserInfoPanel';
import { ChatHistoryProvider, useChatHistory } from '@/app/Library/Context/ChatHistoryContext';
import { CommentsProvider } from '@/app/Library/Context/CommentContext';
import { UserDataProvider, useUserData } from '@/app/Library/Context/UserDataContext';
import { LessonModuleProvider , useLessonModule} from '@/app/Library/Context/LessonModuleContext';
import { AutoSaveManager } from '@/app/studygraph/(studygraph)/services/AutoSaveManager';
import { useLessonModuleMapper } from '@/app/studygraph/(studygraph)/components/hooks/useLessonModuleMapper';
import { SlideShowProvider } from '@/app/Library/Context/SlideShowContext';
import { SlideShowProvider as ROSlideShowProvider } from '@/app/Library/Context/ROSlideShowContext';
import { SearchProvider } from '@/app/Library/Context/SearchContext';
import { Menu, ChevronsLeft } from 'lucide-react';
import SearchModal from './components/layout/SearchModal';
import { AccessLayerProvider, useAccessLayer } from '@/app/Library/Context/AccessLayerContext'; 
import { Role } from './types/access';
import { RefreshModal } from './components/access/RefreshModal';
import ROCanvasView from './components/layout/ReadOnly/ROCanvasView';
import { useCollaborationManager } from './services/collab/useCollaborationManager';
import DocumentAccessManager from './components/hooks/access/DocumentAccessManager';
import { LoadingAnimation } from './LoadingAnimation';
import { CalendarProvider } from '@/app/Library/Context/CalendarContext';
import { Doc } from 'yjs';
import readiness from '@/app/studygraph/(studygraph)/services/DocumentReadinessService';
import { GlobalModalProvider } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';


const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

type PickerArg =
  | string
  | {
      docId: string;
      fileStorageId?: string;
      fileName?: string;
      role?: Role;
      updatedAt?: string; // prefer ISO; AccessLayer uses Date.parse
    };

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
    const router = useRouter();
  const searchParams = useSearchParams();
  const hasLandedRef = useRef(false);
  // Application-level screen states.
  const [currentView, setCurrentView] = useState<'home' | 'map' | 'user'>('home');
  const { isHistoryOpen } = useVersionHistory();
  const {
    createNewDocument,
    docFileID,
    saveToFirebase,
    loadFromFirebase,
    ydoc, takeMapSnapshot, getVisibility
  } = useYDoc();
  const {InitializeUserData, LoadUserData, SaveUserData} = useUserData();
  const {messages, chatDirty, resetDirty } = useChatHistory();
  const { clearHistory } = useUndoRedo();  
  const {clearSelection} = useNodeSelection();
  const access = useAccessLayer();
  
  

   // Reset function from ViewSwitchContext:
   const { resetPdfState, setActiveView, isPanelManuallyOpen, isPanelExpanded, togglePanel, setPanelExpanded } = useViewSwitch();
   const { setDefaultMap, activeConceptMapId } = useLessonModule();  
  // Refs.
  


  // Autosave: using AutoSaveManager.
  const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');

    // Track current readiness subscriptions so we can cleanly dispose on doc switch
  const renderReadyUnsubRef = useRef<null | (() => void)>(null); 
  const saveReadyUnsubRef = useRef<null | (() => void)>(null);   
  const lastSubscribedDocRef = useRef<string | null>(null);      

  // Lesson module mapping hook.
  useLessonModuleMapper();

  // Use the singleton-based collaboration manager
  const { 
    status: collabStatus, 
    connect: collabConnect, 
    disconnect: collabDisconnect, 
    isConnected: collabIsConnected,
    currentDocId: collabCurrentDocId,
    retryInfo,
    resetRetryCounter,
    resetAllRetryCounters
  } = useCollaborationManager({
    onRevoked: ({ docId }) => {
      console.log('AppLayout › Collaboration access revoked for doc:', docId);
      // TODO: Handle revocation - perhaps show modal or redirect to home
      // You might want to call access.clearDoc() or redirect to home view
    },
    onInvalidToken: ({ docId, error }) => {
      console.error('AppLayout › Collaboration token invalid for doc:', docId, error);
      // TODO: Handle invalid token - perhaps refresh auth or show error
    }
  });


 // Connect/disconnect collaboration based on document and view state
  useEffect(() => {
    if (docFileID && currentView === 'map' && ydoc) {
      const visibility = getVisibility();
      console.log('AppLayout › Connecting collaboration for doc:', docFileID, 'visibility:', visibility);
      
      collabConnect(docFileID, ydoc, visibility).catch(error => {
        console.error('AppLayout › Failed to connect collaboration:', error);
      });
    } else if (currentView !== 'map') {
      console.log('AppLayout › Disconnecting collaboration (not in map view)');
      collabDisconnect();
    }
    
    // Note: We don't disconnect when docFileID is null because that might be temporary during loading
  }, [docFileID, currentView, ydoc, getVisibility, collabConnect, collabDisconnect]);


/**
 * Updated document landing logic that removes deprecated share mode handling.
 * The new system uses direct document URLs without token redemption or share mode parameters.
 * Access control is handled automatically through the resolveRole() system and public flags.
 */


/**
 * Updated document landing logic that properly integrates with DocumentAccessManager
 * to prevent loading animation from getting stuck during shared link redemption.
 */
useEffect(() => {
  const docId = searchParams?.get('doc') ?? null;
  
  if (docId && !hasLandedRef.current) {
    hasLandedRef.current = true;

    console.log('AppLayout.tsx 7001 › Landing on shared document', { docId });

    try { 
      documentSession.closeDocument?.(); // no-op if not open
    } catch (e) {
      console.warn('AppLayout.tsx › closeDocument failed (non-fatal)', e); 
    }

    // Step 1: Initialize DocumentAccessManager workflow 
    const manager = DocumentAccessManager.getInstance();
    manager.selectDocument(docId); // Sets PENDING status and creates promise
    console.log('AppLayout.tsx 7001.5 › DocumentAccessManager workflow initiated');

    // Step 2: Clear existing state for clean document load
    clearHistory();
    clearSelection();
    resetPdfState();

    // Step 3: Load document with proper error handling and status management
   const loadDocument = async () => {
  try {
    console.log('AppLayout.tsx 7002 › Starting document load', { docId });

    // (Step 1) Open via orchestrator: fast render from cache, reconcile with server, then connect collaboration
    await documentSession.openDocument(docId, {
      ydoc,
      loadFromFirebase,
    });


     // (Step 1.1) Subscribe to readiness transitions for this doc (Phase 3)
          //            We navigate to 'map' on RENDER_READY to show cached content,
          //            and run user data loading on SAVE_READY.
          // update - 9
          const attachReadiness = (id: string) => {
            // Clean up prior subscriptions
            renderReadyUnsubRef.current?.();
            saveReadyUnsubRef.current?.();

            // Render-Ready subscription
            const rSub = readiness.renderReady$(id).subscribe((s) => {
              console.log('[AppLayout.tsx][4401] renderReady$ event', s); // update - 10
              if (s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY') {
                // Navigate to map and paint cached content immediately
                setActiveView('conceptMap');
                setCurrentView('map');
              }
              if (s.phase === 'ERROR') {
                // Show lightweight offline/failed message via console, UI can add banner
                console.warn('[AppLayout.tsx][4491] render-ready error; staying functional with cache if any', s.error);
              }
            });

            // Save-Ready subscription
            const sSub = readiness.saveReady$(id).subscribe((s) => {
              console.log('[AppLayout.tsx][4402] saveReady$ event', s); // update - 11
              if (s.phase === 'SAVE_READY') {
                // Load per-user data only when authoritative doc is ready
                LoadUserData(id);
              }
            });

            // Store unsub handles
            renderReadyUnsubRef.current = () => rSub.unsubscribe();
            saveReadyUnsubRef.current = () => sSub.unsubscribe();
            lastSubscribedDocRef.current = id;

            console.log('[AppLayout.tsx][4403] readiness subscriptions attached', { docId: id }); // update - 12
          };

          attachReadiness(docId);


    // optionally remove the await if it blocks ui paint, (it shouldn't because it doesn't use a network call)
    // (Step 2) Wait for DocumentAccessManager readiness (kept from your existing flow)
    await manager.waitForDocumentReady(docId);
    console.log('AppLayout.tsx 7002.5 › Document loaded and ready', { docId });

    // (Step 3) Load user data for the document
    LoadUserData(docId);

    // (Step 4) Navigate to map view
    setActiveView('conceptMap');
    setCurrentView('map');

    console.log('AppLayout.tsx 7003 › Document landing completed successfully', { docId });
  } catch (error) {
    console.error('AppLayout.tsx 7004 › Document load failed', { docId, error });
    manager.confirmDocumentReady(docId);
  }
};


    // Execute the load operation
    loadDocument();

    // Step 6: Clean URL by removing query parameters after processing
    router.replace('/studygraph');

  }
}, [searchParams, clearHistory, clearSelection, resetPdfState, loadFromFirebase, setActiveView, router, LoadUserData, ydoc, collabConnect, collabDisconnect, getVisibility]);


  /**
   * @function setupAutosave
   * @description Sets up autosave when on the 'map' view and authenticated, using saveToFirebase.
   */
  useEffect(() => {
    if (currentView === 'map') {
      const autosaveCallback = async () => {
        setSaveStatus('saving');

        // monitor loading spinner issue
   if (!documentSession.isReadyToSave()) {
    console.log('[AppLayout.tsx][9301] › Autosave skipped: session not ready to save');
    setSaveStatus('saved');
    return;
  } 

        try {
          const chatPayload = chatDirty ? messages : undefined;
          await saveToFirebase(chatPayload) ;
          if (chatDirty) resetDirty();
          setSaveStatus('saved');
          try {
            await takeMapSnapshot(activeConceptMapId);
            console.log(` 6007 Snapshot created with active mapID ${activeConceptMapId}`);
          } catch (err){
            console.warn('Snapshot skipped (probably rate-limited):', err);
          }
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
  }, [currentView, ydoc, saveToFirebase, messages, chatDirty, resetDirty, takeMapSnapshot, activeConceptMapId]);


   const visibility = React.useMemo(() => {
    return docFileID ? getVisibility() : 'private';
  }, [docFileID, getVisibility]);




  /**
   * @function handleFileSelect
   * @description
   * Loads a file from Firebase Storage using the loadFromFirebase method provided by YDocContext.
   * This method is invoked when a file tile (from the Recent Files section) is clicked.
   * It updates the document state and navigates the app to the 'map' view.
   *
   * @param {string} fileStorageId - The Firebase Storage identifier for the file.
   */
  const handleFileSelect = async (arg: PickerArg) => {
    
      // initialize default value ??
    const meta =
      typeof arg === 'string' ?
       { docId: arg, fileStorageId: arg, fileName: 'Document', role: undefined, updatedAt: new Date().toISOString() }
        : arg;
        console.log('AppLayout.tsx 8201 › handleFileSelect start', meta);

    try {
      // Step 1: Initialize access manager workflow
    const manager = DocumentAccessManager.getInstance();
    manager.selectDocument(meta.docId);
    await manager.waitForDocumentReady(meta.docId);


    console.log('AppLayout.tsx 8202 › Access manager workflow initiated');
      clearHistory(); 
      clearSelection();
      resetPdfState();

      access.selectDoc(meta.docId, meta.role ? { role: meta.role } : undefined);
      if (meta.role) {
        access.applySignal({
          docId: meta.docId,
          role: meta.role,
          signal: meta.role === 'Viewer' ? null : 'GRANT_EDIT',
          source: 'bootstrap',
          at: meta.updatedAt ?? new Date().toISOString(),
        });
      }
      console.log('AppLayout.tsx 8202 › access seeded (doc + role)', { docId: meta.docId, role: meta.role });


      // Load the document state from Firebase Storage using loadFromFirebase.
      await documentSession.openDocument(meta.docId, {
  ydoc,
  loadFromFirebase,
});


// Step 3: Attach readiness subscriptions for this doc
      const attachReadiness = (id: string) => {
        renderReadyUnsubRef.current?.();
        saveReadyUnsubRef.current?.();

        const rSub = readiness.renderReady$(id).subscribe((s) => {
          console.log('[AppLayout.tsx][4411] renderReady$ (picker) event', s);
          if (s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY') {
            setDefaultMap();
            setActiveView('conceptMap');
            setCurrentView('map');
          }
          if (s.phase === 'ERROR') {
            console.warn('[AppLayout.tsx][4493] render-ready error (picker path)', s.error);
          }
        });

        const sSub = readiness.saveReady$(id).subscribe((s) => {
          console.log('[AppLayout.tsx][4412] saveReady$ (picker) event', s);
          if (s.phase === 'SAVE_READY') {
            LoadUserData(id);
          }
        });

        renderReadyUnsubRef.current = () => rSub.unsubscribe();
        saveReadyUnsubRef.current = () => sSub.unsubscribe();
        lastSubscribedDocRef.current = id;

        console.log('[AppLayout.tsx][4413] readiness subscriptions attached (picker)', { docId: id });
      };

      attachReadiness(meta.docId);

      // Step 4: No further awaits; UI flips to map on render-ready
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
    const manager = DocumentAccessManager.getInstance();
    clearHistory();
    clearSelection();
    resetPdfState();

    const newDocId = await createNewDocument(); // builds ydoc + seeds metadata + (may upload)
    manager.recordNewDocument(newDocId, 'Owner');
    InitializeUserData(newDocId);

    // 🔧 NEW: bootstrap the just-created doc without loadFromFirebase
    await documentSession.openNewDocument(newDocId, {
      ydoc,
    });

    // (Optional) mirror the same readiness wiring used in picker path
    const attachReadiness = (id: string) => {
      renderReadyUnsubRef.current?.();
      saveReadyUnsubRef.current?.();

      const rSub = readiness.renderReady$(id).subscribe((s) => {
        if (s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY') {
          setDefaultMap();
          setActiveView('conceptMap');
          setCurrentView('map');
          }
      });
      const sSub = readiness.saveReady$(id).subscribe((s) => {
        if (s.phase === 'SAVE_READY') {
          LoadUserData(id);
        }
      });

      renderReadyUnsubRef.current = () => rSub.unsubscribe();
      saveReadyUnsubRef.current = () => sSub.unsubscribe();
      lastSubscribedDocRef.current = id;
    };
    attachReadiness(newDocId);

    // Existing UI flips (kept)
    setDefaultMap();
    setActiveView('conceptMap');
    setCurrentView('map');
  } catch (error) {
    console.error('Error creating new document:', error);
  }
};


  const handleTogglePanel = () => {
    console.log('[AppLayout.tsx][8001] Toggle panel requested from AppLayout');
    togglePanel();
  };

  /**
   * @function renderMenuIcon
   * @description Renders the appropriate menu icon based on whether the panel is expanded.
   * @returns {JSX.Element} The menu icon.
   */
  const renderMenuIcon = () => {
    return isPanelExpanded ? <ChevronsLeft className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />;
  };



    /**
   * @function getNavButtonPosition
   * @description Calculates the position of the navigation button based on current view and panel states.
   * @returns {object} CSS positioning styles
   */
  const getNavButtonPosition = () => {
    // Base positioning - always fixed to viewport
    const baseStyles = {
      position: 'fixed' as const,
      top: '1rem',
      zIndex: 50,
    };

    // For home and user views, always show at left edge
    if (currentView === 'home' || currentView === 'user') {
      return {
        ...baseStyles,
        left: '1rem',
      };
    }

    // For map view, adjust based on version history panel state
    if (currentView === 'map') {
      if (isHistoryOpen) {
        // When version history is open, position button over the read-only canvas
        // Assuming version history panel is ~300px wide, position button accordingly
        return {
          ...baseStyles,
          left: '320px', // Version history panel width + margin
        };
      } else {
        // When version history is closed, position at left edge
        return {
          ...baseStyles,
          left: '1rem',
        };
      }
    }

    // Default positioning
    return {
      ...baseStyles,
      left: '1rem',
    };
  };


  // Ensure readiness subscriptions are disposed if component unmounts
  useEffect(() => {
    return () => {
      renderReadyUnsubRef.current?.(); // update - 16
      saveReadyUnsubRef.current?.();   // update - 17
      console.log('[AppLayout.tsx][4420] readiness subscriptions cleaned up on unmount'); // update - 18
    };
  }, []);

  return (
    <div
  className="h-screen w-full flex bg-white theme-warm-board theme-scope"
  data-theme="warm-board"
>

      {/* Display AuthPromptModal if the user is not authenticated */}

      {/* Navigation Panel */}
      <div className="z-50">
        <NavigationController
          isManuallyOpen={isPanelManuallyOpen}
          currentView={currentView}
          onSetView={setCurrentView}
          onExpandedChange={setPanelExpanded}
        />
      </div>

    {/* Toggle button for Navigation Panel - Now with dynamic positioning */}
      {currentView === 'home' && (<button
        onClick={handleTogglePanel}
        className="p-2 bg-gray-100 rounded shadow hover:bg-gray-200 transition-colors"
        style={getNavButtonPosition()}
        title="Toggle Navigation Panel"
        data-testid="nav-toggle-button"
      >
        {renderMenuIcon()}
      </button> ) }

      {/* Screen rendering based on current view */}
      {currentView === 'home' && (
        <div className="flex-1">
          <HomeScreen onFileSelect={handleFileSelect} onCreateNewDocument={handleCreateNewDocument} />
        </div>
      )}
      {currentView === 'map' && (
        <SlideShowProvider>
          <ROSlideShowProvider>
        <div className="flex-1 flex">
          {/* Version History Panel (when open) */}
            {isHistoryOpen && <VersionHistoryPanel />}
                        {/* Canvas & Cards: historical preview or live editing */}
            {isHistoryOpen ? (
              <>
              <div className="canvas-panels flex-1">
                <VHcanvasView/>

                <div className="resource-cell">
                <ROcardDisplay/>
                </div>
                </div>
              </> ) : 
              (
              <>
          
                {(() => {const manager = DocumentAccessManager.getInstance();
                    const currentDocId = manager.getCurrentDocId();
                    const status = manager.getStatus();

                    // Phase 3 refinement:
                    // If access is PENDING but we already reached RENDER_READY, show the canvas
                    // instead of the spinner to display cached content immediately.
                    // Only show the spinner when neither render-ready nor save-ready have fired.
                    // update - 19
                    const snap = currentDocId ? readiness.getSnapshot(currentDocId) : undefined;
                    const hasRenderableCache =
                      !!snap && (snap.phase === 'RENDER_READY' || snap.phase === 'SAVE_READY');

                    if ((status === 'PENDING' || !currentDocId) && !hasRenderableCache) {
                      console.log('AppLayout.tsx 8209 › Showing loading animation', { status, currentDocId });
              return (
                <LoadingAnimation 
                  title="Opening Notebook..." 
                  subtitle="Resolving document access permissions"
                  isOverlay={false}
                  size="large"
                />
              );
            }
            
            // Step 2: Determine canvas mode based on resolved access
            const canEditDoc = currentDocId ? manager.canEdit(currentDocId) : false;
            console.log('AppLayout.tsx 8210 › Canvas mode determined', { 
              docId: currentDocId, 
              canEdit: canEditDoc 
            });
            
            return canEditDoc ? (
              <CanvasView autosaveStatus={saveStatus} handleFileSelect={handleFileSelect}/>
            ) : (
              <ROCanvasView />
            );
          })()}
                
              </>
            ) }
        </div>
        </ROSlideShowProvider>
        </SlideShowProvider>
      )}
      {currentView === 'user' && (
        <div className="flex-1">
          <UserInfoPanel onClose={() => setCurrentView('map')} />
        </div>
      )}

      <RefreshModal
        onRefresh={() => {
          console.log('[AppLayout.tsx][5001] › Refresh modal triggered collaboration restart');
          
          // Step 1: Force collaboration reconnection if needed
          if (collabIsConnected && docFileID) {
            console.log('[AppLayout.tsx][5002] › Disconnecting collaboration for refresh');
            collabDisconnect();
            
            // Step 2: Reconnect after brief delay to allow cleanup
            setTimeout(() => {
              if (docFileID && ydoc) {
                const visibility = getVisibility();
                console.log('[AppLayout.tsx][5003] › Reconnecting collaboration after refresh');
                collabConnect(docFileID, ydoc, visibility).catch(error => {
                  console.error('[AppLayout.tsx][5004] › Collaboration reconnect failed:', error);
                });
              }
            }, 1000);
          }

          // Step 3: Trigger any additional refresh logic you need
          // For example, you might want to reload document state or reset UI components
          console.log('[AppLayout.tsx][5005] › Modal refresh completed');
        }}
      />
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
      <GlobalModalProvider>
        <AccessLayerProvider>
        <YDocProvider>
          <CalendarProvider>
          <ViewSwitchProvider>
            <LessonModuleProvider>
              <FileAssetProvider>
                <NodeSelectionProvider>
                  <UndoRedoProvider>
                    <NodesProvider> 
                  <ResourceProvider>
                    <UserDataProvider>
                     
                      <LessonDataProvider>
                        <CommentsProvider>
                        <ZoomProvider>
                          <LayoutProvider>
                            <ColorThemeProvider>
                              <SubTreeProvider>
                                <VersionHistoryProvider>
                                <SelectionAttachmentProvider>
                                <ChatHistoryProvider>
                                  <SearchProvider>
                                <AppLayoutContent />
                                <SelectionAttachmentHandler />
                                <div id="modal-root" />
                                <SearchModal></SearchModal>
                                </SearchProvider>
                                </ChatHistoryProvider>
                                </SelectionAttachmentProvider>
                                 </VersionHistoryProvider>
                              </SubTreeProvider>
                            </ColorThemeProvider>
                          </LayoutProvider>
                        </ZoomProvider>
                        </CommentsProvider>
                      </LessonDataProvider>
                    </UserDataProvider>
                  </ResourceProvider>
                  </NodesProvider>
                  </UndoRedoProvider>
                </NodeSelectionProvider>
              </FileAssetProvider>
            </LessonModuleProvider>
          </ViewSwitchProvider>
          </CalendarProvider>
        </YDocProvider>
        </AccessLayerProvider>
        </GlobalModalProvider>
      </ApiProvider>
    </GoogleOAuthProvider>
  );
};

export default AppLayout;
