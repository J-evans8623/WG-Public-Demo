// src/app/studygraph/(studygraph)/components/layout/NotesTab.tsx

import React, {
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { ResourceType as CardResourceType } from './buttons/AddResourceDropdown';
import ResourceDisplay from './ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import AddResourceDropdown from './buttons/AddResourceDropdown';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';

interface PendingResource {
  nodeId: string;
  type: CardResourceType;
  title: string;
  content: string;
}

interface NotesTabProps {
  currentTopicTitle: string;
  isEditMode: boolean;
  onSwitchToChat: () => void;
  width: number;
}

export type NotesTabRef = {
  handleAddResource: (type: CardResourceType) => void;
};

/**
 * NotesTab
 * - Shows pending drafts at the top
 * - Then renders the merged list from useOrderedResources (which now includes search history)
 */
const NotesTab = forwardRef<NotesTabRef, NotesTabProps>(
  ({ currentTopicTitle, isEditMode, onSwitchToChat }, ref) => {
    // ---- Hooks & Contexts ----
    const ordered = useOrderedResources();
    const { createResource, updateResource, deleteResource } = useCardCrudOperations();
    const { getNodeTitle } = useNodesContext();
    const { getFocusNode, dismissResource } = useNodeSelection();

    // ---- Local state ----
    const [pending, setPending] = useState<PendingResource[]>([]);
    const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
    const [editingContent, setEditingContent] = useState<
      Record<string, { title: string; content: string }>
    >({});
    const [hoveringCard, setHoveringCard] = useState(false);

    // Expose addResource to parent
    useImperativeHandle(ref, () => ({
      handleAddResource: (type: CardResourceType) => {
        const defaultNode = getFocusNode() || '';
        setPending(p => [
          ...p,
          { nodeId: defaultNode, type, title: '', content: '' },
        ]);
      },
    }));

    // ---- Pending Draft Handlers ----
    const savePending = async (
      idx: number,
      data: { title: string; content: string; image?: File; selectedTopicId?: string }
    ) => {
      const draft = pending[idx];
      if (!draft) return;
      const params: any = {
        nodeId: data.selectedTopicId ?? draft.nodeId,
        type: draft.type,
        title: data.title,
      };
      if (draft.type === 'image') {
        params.description = data.content;
        if (data.image) params.image = data.image;
      } else {
        params.content = data.content;
      }
      await createResource(params);
      setPending(p => p.filter((_, i) => i !== idx));
    };
    const cancelPending = (i: number) =>
      setPending(p => p.filter((_, idx) => idx !== i));

    // ---- Edit Existing Resource Handlers ----
    const toggleEdit = (id: string) => {
      setEditingIds(old => {
        const next = new Set(old);
        if (next.has(id)) {
          next.delete(id);
          setEditingContent(c => {
            const copy = { ...c };
            delete copy[id];
            return copy;
          });
        } else {
          const res = ordered.find(r => r.id === id);
          if (res) {
            let initial = '';
            switch (res.type) {
              case 'picture':
                initial = res.description ? JSON.stringify(res.description) : '';
                break;
              case 'practiceSheet':
                initial = JSON.stringify(res.content);
                break;
              default:
                initial = res.content as string;
            }
            next.add(id);
            setEditingContent(c => ({
              ...c,
              [id]: { title: res.title, content: initial },
            }));
          }
        }
        return next;
      });
    };

    const persistEdits = async (id: string) => {
      const res = ordered.find(r => r.id === id);
      const changes = editingContent[id];
      if (!res || !changes) return;
      if (res.type === 'picture') {
        await updateResource(res, { description: changes.content as any });
      } else {
        await updateResource(res, { title: changes.title, content: changes.content });
      }
      setEditingIds(s => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setEditingContent(c => {
        const copy = { ...c };
        delete copy[id];
        return copy;
      });
    };

    // Helper to unify content access
    const getContent = (r: ResourceCard): string | object => {
      switch (r.type) {
        case 'picture':
          return r.description ?? '';
        case 'practiceSheet':
          return r.content;
        default:
          return r.content;
      }
    };
    // Map library type → display type
    const mapType = (t: string): CardResourceType => {
      switch (t) {
        case 'note': return 'note';
        case 'picture': return 'image';
        case 'cueCard': return 'cuecard';
        case 'practiceSheet': return 'quiz';
        default: return 'note';
      }
    };

    // ---- Render ----
    return (
      <div className="relative h-full flex flex-col">
        <div className={`flex-1 overflow-y-auto px-4 notes-tab-body${hoveringCard ? ' card-hover' : ''}`}>
          <div className="space-y-4 py-4">
            {/* Pending drafts */}
            {pending.map((p, i) => (
              <div
                key={`pending-${i}`}
                onMouseEnter={() => setHoveringCard(true)}
                onMouseLeave={() => setHoveringCard(false)}
              >
                <ResourceDisplay
                  id={`pending-${i}`}
                  type={p.type}
                  ConceptNodeTitle={getNodeTitle(p.nodeId) || currentTopicTitle}
                  title={p.title}
                  content={p.content}
                  isEditing
                  onTitleChange={t =>
                    setPending(prev => {
                      const copy = [...prev];
                      copy[i] = { ...p, title: t };
                      return copy;
                    })
                  }
                  onContentChange={c =>
                    setPending(prev => {
                      const copy = [...prev];
                      copy[i] = { ...p, content: c };
                      return copy;
                    })
                  }
                  onCancel={() => cancelPending(i)}
                  onSave={d =>
                    savePending(i, {
                      title: p.title,
                      content: p.content,
                      image: d?.file,
                      selectedTopicId: d?.selectedTopicId,
                    })
                  }
                  onEdit={() => {}}
                  onDelete={() => cancelPending(i)}
                  onAskAI={onSwitchToChat}
                  onImageCaption={() => {}}
                />
              </div>
            ))}

            {/* No resources message */}
            {ordered.length === 0 && (
              <p className="text-gray-600">Select nodes to view their resources.</p>
            )}

            {/* Render merged resources (includes search history) */}
            {ordered.map(r => (
              <div
                key={r.id}
                onMouseEnter={() => setHoveringCard(true)}
                onMouseLeave={() => setHoveringCard(false)}
              >
                <ResourceDisplay
                  id={r.id}
                  type={mapType(r.type)}
                  ConceptNodeTitle={getNodeTitle(r.nodeId) || 'Untitled'}
                  title={editingContent[r.id]?.title ?? r.title}
                  content={editingContent[r.id]?.content ?? getContent(r)}
                  isEditing={editingIds.has(r.id)}
                  imageUrl={r.type === 'picture' ? r.imageUrl : undefined}
                  onTitleChange={t =>
                    setEditingContent(c => ({
                      ...c,
                      [r.id]: { ...(c[r.id] || {}), title: t },
                    }))
                  }
                  onContentChange={c =>
                    setEditingContent(prev => ({
                      ...prev,
                      [r.id]: { ...(prev[r.id] || {}), content: c },
                    }))
                  }
                  onCancel={() => toggleEdit(r.id)}
                  onSave={() => persistEdits(r.id)}
                  onEdit={() => toggleEdit(r.id)}
                  onDelete={() => deleteResource(r.nodeId, r.id)}
                  onAskAI={onSwitchToChat}
                  onImageCaption={() => {}}
                  onDismiss={() => dismissResource(r.nodeId, r.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar: Add Resource */}
        <div className="bottom-bar">
          <AddResourceDropdown
            onSelectType={type => ref?.current?.handleAddResource(type)}
          />
        </div>
      </div>
    );
  }
);

NotesTab.displayName = 'NotesTab';
export default NotesTab;
