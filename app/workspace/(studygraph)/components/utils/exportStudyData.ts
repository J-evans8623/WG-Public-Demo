// app/workspace/(studygraph)/components/utils/exportStudyData.ts

/**
 * @file exportStudyData.ts
 * @description
 * This file defines a custom hook (useExportStudyData) that exports study data for the concept map.
 *
 * Fix applied: switched from un-memoized function definition to useCallback to ensure
 * referential stability and satisfy ESLint dependency rules.
 */

import { useCallback } from 'react'; // update - 1: use useCallback for functions
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ConceptNode, ResourceCard } from '@/app/Library/Definitions/Definitions';

type ExportedTopic = {
  topicTitle: string;
  topicContent: string;
  cueCardContent: string;
};

type ExportedStudyData = {
  lessonTitle: string;
  topics: ExportedTopic[];
};

/**
 * Custom hook to export study data.
 *
 * @returns A function that accepts an array of node IDs and returns a JSON string containing the lesson title,
 * topics with combined note and cue card contents.
 */
export function useExportStudyData() {
  // Retrieve nodes-related functions and data from NodesContext
  const { nodes, getRootNode } = useNodesContext();
  // Retrieve resource-related functions from ResourceContext
  const { selectResources, selectCueCards } = useResourceContext();

  /**
   * Exports the study data for the specified node IDs.
   * Wrapped in useCallback to maintain a stable reference unless data changes.
   */
  const exportStudyData = useCallback((nodeIds: string[]): string => {
    // Retrieve the root node ID and title from the context
    const rootNodeId = getRootNode();
    const rootNodeTitle = nodes.get(rootNodeId)?.title || '';
    const lessonTitle =
      rootNodeTitle.trim().toLowerCase() === 'root concept'
        ? 'Unnamed Lesson'
        : rootNodeTitle;

    // Map each provided nodeId into an ExportedTopic object
    const topics: ExportedTopic[] = nodeIds.map((nodeId) => {
      const node: ConceptNode | undefined = nodes.get(nodeId);
      if (!node) {
        // If the node is not found, we use a placeholder.
        return {
          topicTitle: 'Unnamed topic',
          topicContent: '',
          cueCardContent: '',
        };
      }

      // If the node title is the default "new concept" (ignoring case), output "Unnamed topic"
      const topicTitle =
        node.title.trim().toLowerCase() === 'new concept'
          ? 'Unnamed topic'
          : node.title;

      // Retrieve all resources for this node
      const allResources: ResourceCard[] = selectResources(nodeId);
      // Filter for note resources (assuming type 'note')
      const noteResources = allResources.filter(
        (res) => res.type === 'note'
      );
      // Concatenate note contents with newline separators
      const topicContent = noteResources.map((res) => res.content).join('\n');

      // Retrieve cue card resources using the dedicated function
      const cueCards = selectCueCards(nodeId);
      // Concatenate cue card contents with newline separators
      const cueCardContent = cueCards.map((res) => res.content).join('\n');

      return {
        topicTitle,
        topicContent,
        cueCardContent,
      };
    });

    // Create the final export data object
    const exportData: ExportedStudyData = {
      lessonTitle,
      topics,
    };

    // Return a prettified JSON string
    return JSON.stringify(exportData, null, 2);
  }, [nodes, getRootNode, selectResources, selectCueCards]); // update - 2: Dependencies tracked here

  return exportStudyData;
}

export default useExportStudyData;