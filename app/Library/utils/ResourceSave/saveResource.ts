// bloom-maps\app\Library\utils\ResourceSave\saveResource.ts
import { CueCard, Picture, PracticeSheet } from '@/app/Library/Definitions/Definitions';

export type ResourceType = 'cueCard' | 'picture' | 'practiceSheet';

interface ResourceSaveParams {
  resourceType: ResourceType;
  nodeId: string;
  addCueCard: (nodeId: string, cueCard: CueCard) => void;
  addPicture: (nodeId: string, picture: Picture) => void;
  addPracticeSheet: (nodeId: string, practiceSheet: PracticeSheet) => void;
  Title?: string;
  cueCardContent?: string;
  bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  image?: File | null;
  pictureDescription?: string;
  practiceSheetContent?: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string }; // Updated structure
}



export function saveResource({
  resourceType,
  nodeId,
  addCueCard,
  addPicture,
  addPracticeSheet,
  Title,
  cueCardContent,
  bloomLevel = 1,
  image = null,
  pictureDescription = '',
  practiceSheetContent,
}: ResourceSaveParams) {
  switch (resourceType) {
    case 'cueCard':
      if (Title && cueCardContent) {
        const newCueCard: CueCard = {
          id: Date.now().toString(),
          title: Title,
          content: cueCardContent,
          bloomLevel,
        };
        addCueCard(nodeId, newCueCard);
      }
      break;

    case 'picture':
      if (image && Title) {
        const newPicture: Picture = {
          id: Date.now().toString(),
          title: Title, // Reusing the title from modal input
          image,
        };
        addPicture(nodeId, newPicture);
      }
      break;

    case 'practiceSheet':
      if (Title && practiceSheetContent) {
        const newPracticeSheet: PracticeSheet = {
          id: Date.now().toString(),
          title: Title,
          // Directly assigning the object as the content
          content: {
            quizType: practiceSheetContent.quizType,
            quizContent: practiceSheetContent.quizContent,
          },
        };
        addPracticeSheet(nodeId, newPracticeSheet);
      }
      break;

    default:
      console.error(`Unknown resource type: ${resourceType}`);
  }
}
