// bloom-maps\app\(client-ui)\ToolBarActions.ts
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { createNewNode } from '@/app/Library/Context/nodesActions';
import { saveResource } from '@/app/Library/utils/ResourceSave/saveResource';
import { v4 as uuidv4 } from 'uuid';

export const useToolBarActions = () => {
  const { dispatch: nodesDispatch } = useNodesContext();
  const { addCueCard } = useCueCardContext();
  const { addPicture } = usePictureContext();
  const { addPracticeSheet } = usePracticeSheetContext();

  // Empty dummy functions to satisfy saveResource parameters
  const dummyAddCueCard = () => {};
  const dummyAddPicture = () => {};
  const dummyAddPracticeSheet = () => {};

  // Function to add a new concept node
  const addConceptNode = (parentNodeId: string, newNodeTitle: string) => {
    const newNodeId = uuidv4(); // Generate a unique ID for the new node
    nodesDispatch(createNewNode(newNodeTitle, parentNodeId, newNodeId));
  };

  // Function to add a cue card resource
  const addCueCardResource = (nodeId: string, resourceData: { title: string; content?: string; bloomLevel?: number }) => {
    const validatedBloomLevel =
      resourceData.bloomLevel && [1, 2, 3, 4, 5, 6].includes(resourceData.bloomLevel)
        ? (resourceData.bloomLevel as 1 | 2 | 3 | 4 | 5 | 6)
        : undefined;

    saveResource({
      resourceType: 'cueCard',
      nodeId,
      addCueCard,
      addPicture: dummyAddPicture, // Pass dummy function for addPicture
      addPracticeSheet: dummyAddPracticeSheet, // Pass dummy function for addPracticeSheet
      cueCardTitle: resourceData.title,
      cueCardContent: resourceData.content,
      bloomLevel: validatedBloomLevel,
    });
  };

  // Function to add a picture resource
  const addPictureResource = (nodeId: string, resourceData: { title: string; image?: File }) => {
    saveResource({
      resourceType: 'picture',
      nodeId,
      addCueCard: dummyAddCueCard, // Pass dummy function for addCueCard
      addPicture,
      addPracticeSheet: dummyAddPracticeSheet, // Pass dummy function for addPracticeSheet
      cueCardTitle: resourceData.title,
      image: resourceData.image,
    });
  };

  // Function to add a practice sheet resource
  const addPracticeSheetResource = (nodeId: string, resourceData: { title: string; quizContent?: string }) => {
    saveResource({
      resourceType: 'practiceSheet',
      nodeId,
      addCueCard: dummyAddCueCard, // Pass dummy function for addCueCard
      addPicture: dummyAddPicture, // Pass dummy function for addPicture
      addPracticeSheet,
      cueCardTitle: resourceData.title,
      practiceSheetContent: {
        quizType: 'matching', // Assuming matching is the default quiz type
        quizContent: resourceData.quizContent ?? '',
      },
    });
  };

  return {
    addConceptNode,
    addCueCardResource,
    addPictureResource,
    addPracticeSheetResource,
  };
};
