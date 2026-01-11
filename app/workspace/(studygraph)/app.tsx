// app.tsx
/***************************************************************************************************
 * @file app.tsx  — Phase 2 (intent + readiness driven)
 * @description
 *   This top-level application shell composes all providers and orchestrates high-level view
 *   switching between "home", "map", and "user". In this Phase 2 revision, the file completely
 *   removes legacy orchestration dependencies and now relies **only** on `YDocContextv2` to
 *   coordinate document lifecycle, following the proposal’s constraints. The UI expresses intent
 *   via `requestCreateDocument()` and `requestSelectDocument(docId)`, and then reacts to the
 *   context’s `bootPhase`, `renderReady`, and `saveReady` flags to:
 *     (1) flip to map on cached-first-paint (renderReady),
 *     (2) run per-user data hydration on authoritative readiness (saveReady),
 *     (3) connect/disconnect collaboration only when the machine is stable (`bootPhase==='ACTIVE'`)
 *         and `saveReady===true` while we’re on the map view,
 *     (4) gate autosave on `saveReady===true`.
 *
 *   The *select* path is three-state (Close → CacheCheck → AuthoritativeLoad), enabling fast
 *   first paint when cache exists. The *create* path remains two-state (Close → Create) and
 *   non-blocking from the UI’s perspective. We keep all pre-existing styling and layout intact.
 *   Purposeful console logs include a file tag and a short 4-digit code for quick grep during
 *   production debugging. All steady-state computations are O(1); work that scales with content
 *   (e.g., encoding/saving) is O(N) in update bytes, and is already handled in the underlying
 *   context/services. This file itself contains no quadratic scans and avoids unnecessary renders
 *   by gating effects on the precise readiness and phase signals the context provides.
 ***************************************************************************************************/

'use client';

import 'katex/dist/katex.min.css';
import '@/app/workspace/styles/tokens.css';
import '@/app/workspace/styles/brand/brand-utilities.css';
import '@/app/workspace/styles/theme-warm-board.css';
import '@/app/workspace/(studygraph)/canvas/Map/NodeGraphOriginal.css';
import '@/app/workspace/(studygraph)/components/layout/forum/ForumModal.css';
import '@/app/workspace/(studygraph)/components/layout/Canvas/CanvasView.css';
import './appLayout.css';
import '@/app/workspace/(studygraph)/components/layout/home/file-tile.css'
import '@/app/workspace/(studygraph)/components/layout/home/homeScreenV3.css'

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { ApiProvider } from '@/app/src/context/ApiContext';
import { NodeSelectionProvider, useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { NodesProvider } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider } from '@/app/Library/Context/ZoomProvider';
import { ViewSwitchProvider, useViewSwitch } from '@/app/workspace/(studygraph)/components/layout/Canvas/pdf/ViewSwitchContext';
import { LayoutProvider } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider } from '@/app/Library/Context/ColorThemeProvider';
import { UndoRedoProvider, useUndoRedo } from './components/Context/UndoRedoContext';
import { ResourceProvider } from '@/app/Library/Context/ResourceContext';
import { LessonDataProvider } from '@/app/Library/Context/LessonDataContext';

import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext'; 

import { FileAssetProvider } from '@/app/Library/Context/FileAssetContext';
import { SelectionAttachmentProvider } from '@/app/Library/Context/SelectionAttachmentContext';


import SelectionAttachmentHandler from './components/layout/Canvas/SelectionAttachmentHandler';
import HomeScreen from './components/layout/home/HomescreenV3';
import NavigationPanel from './NavigationPanel';
import { CanvasView } from '@/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CanvasView';
import { UserInfoPanel } from '@/app/workspace/(studygraph)/components/layout/UserInfoPanel';
import { ChatHistoryProvider, useChatHistory } from '@/app/Library/Context/ChatHistoryContext';
import { CommentsProvider } from '@/app/Library/Context/forum/CommentContext';
import { UserDataProvider } from '@/app/Library/Context/UserDataContext';
import { LessonModuleProvider, useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { AutoSaveManager } from '@/app/workspace/(studygraph)/services/autosave/AutoSaveManager';
import { useLessonModuleMapper } from '@/app/workspace/(studygraph)/components/hooks/useLessonModuleMapper';
import { SlideShowProvider } from '@/app/Library/Context/SlideShowContext';
import { SearchProvider } from '@/app/Library/Context/SearchContext';
import { Menu, ChevronsLeft } from 'lucide-react';
import SearchModal from './components/layout/SearchModal';
import { AccessLayerProvider, useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import { Role } from './types/access';
import { RefreshModal } from './components/access/RefreshModal';
import { CalendarProvider } from '@/app/Library/Context/CalendarContextv2';
import { GlobalModalProvider, useGlobalModal } from '@/app/workspace/(studygraph)/components/modals/GlobalModalProvider';
import { registerAutosaveHandlers } from '@/app/workspace/(studygraph)/services/autosave/autoSaveBridge';
import { CollabProvider, useCollab } from '@/app/Library/Context/collab/CollabContext'; 
import { MobileOptimizationModal } from '@/components/layout/MobileOptimizationModal';
import { StudyLogProvider } from '@/app/Library/Context/studylog/StudyLogContext';

type PickerArg =
  | string
  | {
      docId: string;
      fileStorageId?: string;
      fileName?: string;
      role?: Role;
      updatedAt?: string;
    };

/**
 * @function AppLayoutContent
 * @description
 *   Owns the high-level screens, sets up autosave, collaboration gating, and wires the
 *   top-level flows (create/select) **only** through YDocContext’s intents and readiness.
 *   The function keeps UI responsive by flipping to the map view on `renderReady` and
 *   by performing per-user hydration (user data) on `saveReady`. All effects are gated
 *   to run O(1) work on phase/flag changes, avoiding redundant calls.
 */
const AppLayoutContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // View state
  const [currentView, setCurrentView] = useState<'home' | 'map' | 'user'>('home');

  // update - 4: read only from YDocContextv2
  const {
    ydoc,
    docFileID,
    requestCreateDocument, // intent
    requestSelectDocument, // intent
    saveToFirebase,
    getVisibility,
    bootPhase,
    renderReady,
    saveReady,
    triggerViewSwitch,
    setTriggerViewSwitch,
    bootError,
    clearBootError,
  } = useYDoc();

  const { messages, chatDirty, resetDirty } = useChatHistory();
  const { clearHistory } = useUndoRedo();
  const { clearSelection } = useNodeSelection();
  const { setDefaultMap, activeConceptMapId } = useLessonModule();
  const { resetPdfState, setActiveView, isPanelManuallyOpen, isPanelExpanded, togglePanel, setPanelExpanded, requestLessonplay } =
    useViewSwitch();

  const { showModal, hideModal } = useGlobalModal();
  const access = useAccessLayer();


  const hasHandledLandingRef = useRef(false);
  const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');

  // Map local convenience of current visibility (does not cause re-renders if unchanged)
  const visibility = useMemo(() => (docFileID ? getVisibility() : 'private'), [docFileID, getVisibility]);

  // Keep Lesson mapping fresh
  useLessonModuleMapper();
  // Collaboration connection lifecycle
  const { status: collabStatus, restart } = useCollab();

  // update - 5: shared-link landing — express **only intent**, let context drive readiness
  useEffect(() => {
    const doc = searchParams?.get('doc');
    if (!doc || hasHandledLandingRef.current) return;

    hasHandledLandingRef.current = true;
    //console.log('app.tsx 7001 › landing with shared doc id', { doc });

    // (1) Clear transient UI state for a clean open
    clearHistory();
    clearSelection();
    resetPdfState();

    // (2) Show a lightweight overlay
    showModal('loadingOverlay', {
      title: 'Opening Notebook…',
      subtitle: 'Checking cache and loading content',
      size: 'large',
    });


    // update - 1: Trigger Analytics "Catch" (Conversion)
    // We fire this network request immediately but do NOT await it.
    // This ensures the UI feels instant while we log the event in the background.
    // We hardcode the source as 'campus_flyer_qr' for this campaign context.
    fetch('/api/analytics/track-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        docId: doc, 
        source: 'campus_flyer_qr' 
      })
    }).catch(err => {
      // Non-fatal error logging. Analytics failure should never break the app.
      console.warn('[Analytics] Failed to track conversion:', err);
    });
    



    // (3) Express intent — state machine (Close→CacheCheck→AuthoritativeLoad)
    requestSelectDocument(doc);

    // (4) Clean URL -> let first visits being prompted to bookmark homescreen instead of specific shared document ? 
    router.replace('/workspace');

    // (5) request lesson play
    requestLessonplay()
  }, [searchParams, clearHistory, clearSelection, resetPdfState, requestSelectDocument, router, showModal, requestLessonplay]); // update - 5

  // update - 6: picker-driven select handler — intent-only
  const handleFileSelect = async (arg: PickerArg) => {
    const meta = typeof arg === 'string' ? { docId: arg } : arg;
    console.log('app.tsx 8201 › handleFileSelect', meta);

    // [1] Reset transient UI state
    clearHistory();
    clearSelection();
    resetPdfState();

    // [2] Proactively seed AccessLayer role (best-effort; the authoritative access comes later)
    if (meta.role) {
      access.applySignal({
        docId: meta.docId,
        role: meta.role,
        signal: meta.role === 'Viewer' ? null : 'GRANT_EDIT',
        source: 'bootstrap',
        at: meta.updatedAt ?? new Date().toISOString(),
      });
    }

    // [3] Show overlay immediately
    showModal('loadingOverlay', {
      title: 'Opening Notebook…',
      subtitle: 'Loading cached content, then syncing',
      size: 'large',
    });

    // [4] Express intent
    requestSelectDocument(meta.docId);
  };

  // update - 7: create handler — intent-only two-state path
  const handleCreateNewDocument = async () => {
    console.log('app.tsx 8601 › handleCreateNewDocument');
    clearHistory();
    clearSelection();
    resetPdfState();

    showModal('loadingOverlay', {
      title: 'Creating Notebook…',
      subtitle: 'Preparing a fresh workspace',
      size: 'large',
    });

    requestCreateDocument();
  };

  // update - 8: react to readiness flags uniformly for every open/create flow
  useEffect(() => {
    
    // (A) flip to map on first renderable signal
    if (renderReady && triggerViewSwitch) {
      //setDefaultMap();
      setActiveView('conceptMap');
      setCurrentView('map');
      hideModal(); // dismiss loading overlay as soon as something is renderable
      console.log('app.tsx 4401 › renderReady observed → map view');
      setTriggerViewSwitch(false);
    }

  }, [renderReady, saveReady, docFileID, setActiveView, hideModal, triggerViewSwitch, setTriggerViewSwitch]); // update - 8



  useEffect(() => {
    if (!bootError) return;

    // Ensure we never leave the user stuck behind a loading overlay
    hideModal();

    console.warn('app.tsx 4701 › bootError observed → docUnavailable modal', {
      docId: bootError.docId,
      code: bootError.code,
      reason: bootError.reason,
      at: bootError.at,
    });

    showModal('docUnavailable', {
      title: 'Notebook unavailable',
      message: bootError.message,
      onClose: () => {
        try {
          clearBootError();
        } catch (e) {
          console.warn('app.tsx 4702 › clearBootError failed (non-fatal)', e);
        }

        // Return to a safe UX state
        setCurrentView('home');
        router.replace('/workspace');
      },
    });
  }, [bootError, hideModal, showModal, clearBootError, router]);



  // update - 10: autosave — gated solely by ACTIVE + saveReady
  useEffect(() => {
    if (currentView !== 'map') return;

    const autosaveCallback = async () => {
      setSaveStatus('saving');

      if (!(bootPhase === 'ACTIVE' && saveReady)) {
        console.log('app.tsx 9301 › autosave skipped: not ACTIVE/saveReady', { bootPhase, saveReady });
        setSaveStatus('saved');
        return;
      }

      try {
        const chatPayload = chatDirty ? messages : undefined;
        const result = await saveToFirebase(chatPayload);
        console.log('app.tsx 9302 › autosave result', { result });
        if (chatDirty) resetDirty();
        setSaveStatus('saved');

        try {
          //await takeMapSnapshot(activeConceptMapId);
          console.log('app.tsx 6007 › snapshot created', { activeConceptMapId });
        } catch (e) {
          console.warn('app.tsx 6008 › snapshot skipped', e);
        }
      } catch (e) {
        console.error('app.tsx 9303 › autosave error', e);
      }
    };

    if (!autoSaveManagerRef.current) {
      autoSaveManagerRef.current = new AutoSaveManager(ydoc, autosaveCallback);
      console.log('app.tsx 9304 › AutoSaveManager initialized');
    }

    // REGISTER bridge handlers here:
    registerAutosaveHandlers(
      () => autoSaveManagerRef.current?.notifyLocalChange(),
      () => { void autoSaveManagerRef.current?.forceSave(); }
    );
  

    return () => {
      autoSaveManagerRef.current?.destroy();
      autoSaveManagerRef.current = null;
      registerAutosaveHandlers(() => {}, () => {})
      console.log('app.tsx 9305 › AutoSaveManager destroyed');
    };
  }, [
    currentView,
    ydoc,
    bootPhase,
    saveReady,
    chatDirty,
    messages,
    resetDirty,
    saveToFirebase,
    activeConceptMapId,
  ]); // update - 10

  // UI helpers (unchanged behavior)
  const handleTogglePanel = () => {
    console.log('app.tsx 8001 › toggle nav panel');
    togglePanel();
  };

  const renderMenuIcon = () => {
    return isPanelExpanded ? (
      <ChevronsLeft className="w-5 h-5 text-gray-600" />
    ) : (
      <Menu className="w-5 h-5 text-gray-600" />
    );
  };

  const getNavButtonPosition = () => {
    const base = { position: 'fixed' as const, top: '1rem', zIndex: 50 };
    if (currentView === 'home' || currentView === 'user') return { ...base, left: '1rem' };
    if (currentView === 'map') {
      return { ...base, left: '1rem' };
    }
    return { ...base, left: '1rem' };
  };

  return (
    <div className="h-screen w-full flex bg-white theme-warm-board theme-scope" data-theme="warm-board">
      {/* Navigation Panel */}
      <div className="z-50">
        <NavigationPanel
          isManuallyOpen={isPanelManuallyOpen}
          currentView={currentView}
          onSetView={setCurrentView}
          onExpandedChange={setPanelExpanded}
        />
      </div>

      {/* Toggle button – shown on home for quick nav */}
      {currentView === 'home' && (
        <button
          onClick={handleTogglePanel}
          className="p-2  hover:bg-gray-200 transition-colors"
          style={getNavButtonPosition()}
          title="Toggle Navigation Panel"
          data-testid="nav-toggle-button"
        >
          {renderMenuIcon()}
        </button>
      )}

      {/* Screens */}
      {currentView === 'home' && (
        <div className="flex-1">
          <HomeScreen onFileSelect={handleFileSelect} onCreateNewDocument={handleCreateNewDocument} />
        </div>
      )}

      {currentView === 'map' && 
      (
        <div className="flex-1 flex">            
                <CanvasView autosaveStatus={saveStatus} handleFileSelect={handleFileSelect} />
        </div> 
      ) 
    }

      {currentView === 'user' && (
        <div className="flex-1">
          <UserInfoPanel onClose={() => setCurrentView('map')} />
        </div>
      )}

      {/* Reconnect collab on demand, guarded by ACTIVE */}
      <RefreshModal
        onRefresh={() => {
          console.log('app.tsx 5001 › refresh modal → collab restart');
          restart(); 
        }}
      />
      <MobileOptimizationModal />
    </div>
  );
};

/**
 * @function AppLayout
 * @description
 *   Provider composition wrapper. No orchestration logic lives here; wiring remains identical to
 *   previous versions so styling and context behaviors are preserved.
 */
export const AppLayout: React.FC = () => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ApiProvider>
        
          <AccessLayerProvider>
            <YDocProvider>
              <CollabProvider>
              
                <GlobalModalProvider>
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
                                       
                                              <SelectionAttachmentProvider>
                                                <ChatHistoryProvider>
                                                  <SearchProvider>
                                                    <StudyLogProvider>
                                                    <SlideShowProvider>
                                                      
                                                      <AppLayoutContent />
                                                     
                                                    </SlideShowProvider>
                                                     </StudyLogProvider>
                                                    <SelectionAttachmentHandler />
                                                    <div id="modal-root" />
                                                    <SearchModal />
                                                  </SearchProvider>
                                                </ChatHistoryProvider>
                                              </SelectionAttachmentProvider>
                                        
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
                </GlobalModalProvider>
              </CollabProvider>
            </YDocProvider>
          </AccessLayerProvider>
      </ApiProvider>
    </GoogleOAuthProvider>
  );
};

export default AppLayout;
