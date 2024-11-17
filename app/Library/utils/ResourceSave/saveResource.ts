// bloom-maps/app/Library/utils/ResourceSave/saveResource.ts

import { ResourceType, CueCardResource, PictureResource, PracticeSheetResource, ResourceCard } from '@/app/Library/Definitions/Definitions';

interface ResourceSaveParams {
  resourceType: ResourceType;
  nodeId: string;
  addResource: (resource: Omit<ResourceCard, 'id'>) => void;
  Title?: string;
  cueCardContent?: string;
  bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  image?: File | null;
  pictureDescription?: string; // Added field
  practiceSheetContent?: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string };
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
  pictureDescription = '', // Default value
  practiceSheetContent,
}: ResourceSaveParams) {
  switch (resourceType) {
    case 'cueCard':
      if (Title && cueCardContent) {
        addResource({
          type: 'cueCard',
          nodeId,
          title: Title,
          content: cueCardContent,
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
          content: practiceSheetContent,
        } as PracticeSheetResource);
      } else {
        console.error('Title and practice sheet content are required for PracticeSheet');
      }
      break;

    default:
      console.error(`Unknown resource type: ${resourceType}`);
  }
}
