// bloom-maps/app/Library/utils/ResourceSave/saveResource.ts

import { ResourceType, IQuizQuestion, CueCardResource, PictureResource, PracticeSheetResource, ResourceCard, QuizType } from '@/app/Library/Definitions/Definitions';
import { Descendant } from 'slate';

interface ResourceSaveParams {
  resourceType: ResourceType;
  nodeId: string;
  addResource: (resource: Omit<ResourceCard, 'id'>) => void;
  Title?: string;
  cueCardContent?: Descendant[];
  image?: File | null;
  pictureDescription?: Descendant[]; // Added field
  practiceSheetContent?: { quizType: QuizType; quizContent: IQuizQuestion[] };
  source?: string,
}

/**
 * Saves a resource by adding it through the centralized ResourceContext's addResource method.
 * Ensures all required fields are present based on the resource type.
 * @param params - The parameters for the resource to save.
 */
export function saveResource({
  resourceType,
  nodeId,
  addResource,
  Title,
  cueCardContent,
  image = null,
  pictureDescription, // Default value
  practiceSheetContent,
  source,
}: ResourceSaveParams) {
  switch (resourceType) {
    case 'cueCard':
      if (Title && cueCardContent) {
        addResource({
          type: 'cueCard',
          nodeId,
          title: Title,
          content: cueCardContent,
          source,
        } as CueCardResource);
      } else {
        console.error('Title and content are required for CueCard');
      }
      break;

    case 'picture':
      if (image && Title) {
        addResource({
          type: 'picture',
          nodeId,
          title: Title,
          image,
          description: pictureDescription, // Pass the description
          source,
        } as PictureResource);
      } else {
        console.error('Title and image are required for Picture');
      }
      break;

    case 'practiceSheet':
      if (Title && practiceSheetContent) {
        addResource({
          type: 'practiceSheet',
          nodeId,
          title: Title,
          content:{
            quizType : practiceSheetContent.quizType,
            quizContent :practiceSheetContent.quizContent,
          } ,
        }  as  Omit<PracticeSheetResource, 'id'>);
      } else {
        console.error('Title and practice sheet content are required for PracticeSheet');
      }
      break;

    default:
      console.error(`Unknown resource type: ${resourceType}`);
  }
}
