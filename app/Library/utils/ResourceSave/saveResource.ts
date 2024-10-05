// saveResource.ts

import { CueCard, Picture, PracticeSheet } from '@/app/Library/Definitions/Definitions';


export type ResourceType = 'cueCard' | 'picture' | 'practiceSheet';

interface ResourceSaveParams {
  resourceType: ResourceType;
  nodeId: string;
  addCueCard: (nodeId: string, cueCard: CueCard) => void;
  addPicture: (nodeId: string, picture: Picture) => void;
  addPracticeSheet: (nodeId: string, practiceSheet: PracticeSheet) => void;
  cueCardTitle?: string;
  cueCardContent?: string;
  bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  image?: File | null;
  pictureDescription?: string;
  practiceSheetContent?: string;
}

export function saveResource({
  resourceType,
  nodeId,
  addCueCard,
  addPicture,
  addPracticeSheet,
  cueCardTitle,
  cueCardContent,
  bloomLevel = 1,
  image = null,
  pictureDescription = '',
  practiceSheetContent = '',
}: ResourceSaveParams) {
  switch (resourceType) {
    case 'cueCard':
      if (cueCardTitle && cueCardContent) {
        const newCueCard: CueCard = {
          id: Date.now().toString(),
          title: cueCardTitle,
          content: cueCardContent,
          bloomLevel,
        };
        addCueCard(nodeId, newCueCard);
      }
      break;

    case 'picture':
      if (image && cueCardTitle) {
        const newPicture: Picture = {
          id: Date.now().toString(),
          title: cueCardTitle, // Reusing the title from modal input
          image,
        };
        addPicture(nodeId, newPicture);
      }
      break;

    case 'practiceSheet':
      if (cueCardTitle && practiceSheetContent) {
        const newPracticeSheet: PracticeSheet = {
          id: Date.now().toString(),
          title: cueCardTitle,
          content: practiceSheetContent,
        };
        addPracticeSheet(nodeId, newPracticeSheet);
      }
      break;

    default:
      console.error(`Unknown resource type: ${resourceType}`);
  }
}
