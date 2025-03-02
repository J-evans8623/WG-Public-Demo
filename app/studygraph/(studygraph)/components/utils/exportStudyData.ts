/**
 * @file exportStudyData.ts
 * @description
 * This file defines a custom hook (useExportStudyData) that exports study data for the concept map.
 * It reads from the NodesProvider and ResourceContext providers and generates a JSON text output
 * with the following structure:
 *
 * {
 *   "lessonTitle": "Lesson Title", // The title of the root node unless it is "root concept", then "Unnamed Lesson"
 *   "topics": [
 *     {
 *       "topicTitle": "Topic Title",          // Actual node title or "Unnamed topic" if it is "new concept"
 *       "topicContent": "note 1\nnote 2\n...",   // Combined content from note resources of that node
 *       "cueCardContent": "cueCard 1\ncueCard 2\n..." // Combined content from cue card resources of that node
 *     },
 *     ... more topics
 *   ]
 * }
 *
 * The hook returns a function which when given an array of node IDs produces this JSON string.
 *
 * Responsibilities:
 * - Read the current nodes from the NodesProvider context.
 * - Read resources (notes and cue cards) from the ResourceContext.
 * - Format the lesson title and topics according to the business logic.
 * - Export a JSON text string ready for printing or backend transmission.
 */

import { useMemo } from 'react';
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
 *          topics with combined note and cue card contents.
 */
export function useExportStudyData() {
  // Retrieve nodes-related functions and data from NodesContext
  const { nodes, getRootNode } = useNodesContext();
  // Retrieve resource-related functions from ResourceContext
  const { selectResources, selectCueCards } = useResourceContext();

  /**
   * Exports the study data for the specified node IDs.
   *
   * For the lesson title, it uses the root node title from the context. If the title is "root concept"
   * (ignoring case), then "Unnamed Lesson" is used.
   *
   * For each provided concept node ID:
   * - The topic title is set to the node title unless it matches "new concept" (ignoring case), in which case "Unnamed topic" is used.
   * - The note contents are concatenated (each note’s "content") with newline separators.
   * - The cue card contents are similarly concatenated.
   *
   * @param nodeIds - Array of concept node IDs to export.
   * @returns A formatted JSON string.
   */
  const exportStudyData = (nodeIds: string[]): string => {
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
  };

  // useMemo to avoid unnecessary recomputation if dependencies have not changed
  return useMemo(() => exportStudyData, [nodes, selectResources, selectCueCards, getRootNode]);
}

export default useExportStudyData;
