/***************************************************************************************
 * @file app/Library/controllers/AppBootstrapBridge.tsx
 * @description
 *   Thin integration component that demonstrates how to use the Canvas Mode Controller
 *   with your existing contexts (YDoc + UserData). It exposes a single `open(docId)`
 *   function you can call from your file picker / router. The orchestration follows
 *   the Phase-1 flow precisely: stop DocAutoSave → flush user data → bootstrap → mount.
 ***************************************************************************************/

import React, { useCallback } from 'react';
import { useCanvasModeController } from './CanvasModeController';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';

// TODO: swap with your real canvases
const ViewerCanvas: React.FC = () => <div data-testid="viewer">Viewer</div>;
const EditorCanvas: React.FC = () => <div data-testid="editor">Editor</div>;

export const AppBootstrapBridge: React.FC = () => {
  const { SaveUserData } = useUserData();
  const { docFileID, setDocId } = useYDoc() as any; // assuming YDocContext exposes setDocId

  // 1) Define orchestration callbacks used by the controller
  const stopDocAutoSave = useCallback(async (prevDocId?: string) => {
    // Phase 5 will wire a real stop; here we only log as a checkpoint.
    console.log('[AppBootstrapBridge.tsx][7301] › stopDocAutoSave called', { prevDocId });
  }, []);

  const tryFlushUserData = useCallback(async (prevDocId?: string) => {
    if (!prevDocId) return;
    try {
      console.log('[AppBootstrapBridge.tsx][7302] › tryFlushUserData start', { prevDocId });
      await SaveUserData(prevDocId);
      console.log('[AppBootstrapBridge.tsx][7303] › tryFlushUserData ok', { prevDocId });
    } catch (e) {
      console.warn('[AppBootstrapBridge.tsx][7391] › tryFlushUserData failed', e);
    }
  }, [SaveUserData]);

  const { state, openDoc } = useCanvasModeController({
    stopDocAutoSave,
    tryFlushUserData,
    onAcl(acl) {
      console.log('[AppBootstrapBridge.tsx][7304] › ACL received', acl);
      // Inform YDoc which doc we’re working on (if your context exposes a setter)
      if (typeof setDocId === 'function') setDocId(acl.docId);
    },
  });

  // 2) Example: programmatically open a doc (you likely call this from router or picker)
  // openDoc('some-doc-id');

  // 3) Render the correct canvas based on controller state
  if (state.view.kind === 'opening') return <div>Loading document…</div>;
  if (state.view.kind === 'error') return <div>Access Error: {state.view.message}</div>;
  if (state.view.kind === 'viewing:editor') return <EditorCanvas />;
  if (state.view.kind === 'viewing:viewer') return <ViewerCanvas />;
  return <div>Select a document to begin.</div>;
};
