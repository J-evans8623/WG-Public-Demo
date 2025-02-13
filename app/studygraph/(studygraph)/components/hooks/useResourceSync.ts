// src/Library/hooks/useResourceSync.ts
import { useMemo } from 'react';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import {
  CueCardResource,
  PictureResource,
  PracticeSheetResource,
  NoteResource,
} from '@/app/Library/Definitions/Definitions';

/**
 * useResourceSync
 *
 * This hook synchronizes the currently selected nodes with their associated resources.
 * It now supports multi-selection and includes note resources.
 */
export const useResourceSync = () => {
  // Get the selected node IDs from the context.
  const { getSelectedNodeIds } = useNodeSelection();
  const selectedNodeIds = getSelectedNodeIds(); // e.g., ['node1', 'node2', ...]

  // Get resource selection functions.
  const { selectCueCards, selectPictures, selectPracticeSheets, selectResources } = useResourceContext();

  // Get node metadata.
  const { nodes } = useNodesContext();

  // For each selected node, gather resources and enrich them with node metadata.
  const aggregatedResources = useMemo(() => {
    // Initialize aggregated arrays.
    const aggregatedCueCards: CueCardResource[] = [];
    const aggregatedPictures: PictureResource[] = [];
    const aggregatedPracticeSheets: PracticeSheetResource[] = [];
    const aggregatedNotes: NoteResource[] = [];

    selectedNodeIds.forEach((nodeId) => {
      const nodeTitle = nodes.get(nodeId)?.title || 'Untitled';
      const cueCards = selectCueCards(nodeId).map((resource) => ({
        ...resource,
        conceptNodeTitle: nodeTitle,
      }));
      const pictures = selectPictures(nodeId).map((resource) => ({
        ...resource,
        conceptNodeTitle: nodeTitle,
      }));
      const practiceSheets = selectPracticeSheets(nodeId).map((resource) => ({
        ...resource,
        conceptNodeTitle: nodeTitle,
      }));
      // Use the generic selector to obtain all resources and then filter for notes.
      const allResources = selectResources(nodeId);
      const notes = allResources.filter(
        (resource): resource is NoteResource => resource.type === 'note'
      ).map((resource) => ({
        ...resource,
        conceptNodeTitle: nodeTitle,
      }));

      aggregatedCueCards.push(...cueCards);
      aggregatedPictures.push(...pictures);
      aggregatedPracticeSheets.push(...practiceSheets);
      aggregatedNotes.push(...notes);
    });

    return {
      cueCards: aggregatedCueCards,
      pictures: aggregatedPictures,
      practiceSheets: aggregatedPracticeSheets,
      notes: aggregatedNotes,
    };
  }, [selectedNodeIds, selectCueCards, selectPictures, selectPracticeSheets, selectResources, nodes]);

  return {
    selectedNodeIds,
    ...aggregatedResources,
  };
};
