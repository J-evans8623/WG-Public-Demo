/**
 * @file pages/api/calendar/notebook-details.ts
 * @description
 *   API endpoint for retrieving detailed notebook metadata including lesson units for calendar
 *   planning. This endpoint handles POST requests with an array of file IDs and returns comprehensive
 *   notebook metadata required for schedule generation. The implementation fetches file metadata
 *   from Firestore, validates lesson unit data, and provides properly formatted responses for
 *   calendar service consumption. The endpoint includes authentication, input validation, and
 *   error handling while ensuring efficient data retrieval for multiple notebooks. This service
 *   enables the calendar system to load detailed metadata only when needed for schedule generation
 *   rather than loading all metadata upfront for selection interfaces. The response includes
 *   complete notebook metadata with lesson units organized for optimal calendar scheduling
 *   performance and user experience.
 *
 * Responsibilities:
 *   - Authenticate user requests through NextAuth session validation
 *   - Validate and process array of file IDs from request body
 *   - Fetch detailed file metadata including lesson unit information
 *   - Format and validate lesson unit data for calendar consumption
 *   - Provide proper error handling and response formatting
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';
import { NotebookMeta, LessonUnit, LessonUnitsMeta } from '@/app/Library/Definitions/CalendarDefinitions';

interface NotebookDetailsRequest {
  fileIds: string[];
}

/**
 * Type guard to validate LessonUnit structure from Firestore data.
 * Ensures data integrity when converting unknown Firestore objects
 * to typed LessonUnit structures for calendar processing.
 */
function isValidLessonUnit(obj: any): obj is LessonUnit {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.conceptNodeTitle === 'string' &&
    typeof obj.primaryConceptNodeID === 'string' &&
    typeof obj.parentTitle === 'string' &&
    typeof obj.mapID === 'string'
  );
}

/**
 * Safely extracts and validates lesson units from Firestore metadata.
 * Performs type checking and validation to ensure data integrity
 * while converting from unknown Firestore structure to typed arrays.
 */
function extractLessonUnits(lessonUnitsMeta: any): LessonUnit[] {
  console.log('[notebook-details.ts][3011] › Extracting lesson units from metadata');
  
  if (!lessonUnitsMeta || !lessonUnitsMeta.units) {
    console.warn('[notebook-details.ts][3012] › No units found in metadata');
    return [];
  }
  
  const allUnits: LessonUnit[] = [];
  
  // Step 1: Iterate through each map's units
  Object.entries(lessonUnitsMeta.units).forEach(([mapId, units]) => {
    console.log('[notebook-details.ts][3013] › Processing units for map:', mapId);
    
    if (!Array.isArray(units)) {
      console.warn('[notebook-details.ts][3014] › Units for map', mapId, 'is not an array');
      return;
    }
    
    // Step 2: Validate and convert each unit
    units.forEach((unit: any, index: number) => {
      if (isValidLessonUnit(unit)) {
        allUnits.push(unit);
        console.log('[notebook-details.ts][3015] › Added valid unit:', unit.conceptNodeTitle);
      } else {
        console.warn('[notebook-details.ts][3016] › Invalid unit at index', index, 'in map', mapId, ':', unit);
      }
    });
  });
  
  console.log('[notebook-details.ts][3017] › Extracted', allUnits.length, 'valid lesson units');
  return allUnits;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log('[notebook-details.ts][3001] › Processing notebook details request');

  // Step 1: Authenticate user session
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('[notebook-details.ts][3002] › Authentication failed');
    return;
  }

  try {
    const { fileIds } = req.body as NotebookDetailsRequest;

    // Step 2: Validate request body
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      console.log('[notebook-details.ts][3003] › Invalid or empty file IDs array');
      return res.status(400).json({ error: 'Valid fileIds array is required' });
    }

    console.log('[notebook-details.ts][3004] › Loading details for', fileIds.length, 'notebooks');

    // Step 3: Fetch file metadata from Firestore
    const notebooks: NotebookMeta[] = [];
    
    for (const fileId of fileIds) {
      try {
        const docSnapshot = await firestore.collection('userFiles').doc(fileId).get();
        
        if (!docSnapshot.exists) {
          console.warn('[notebook-details.ts][3005] › File not found:', fileId);
          continue;
        }
        
        const data = docSnapshot.data();
        
        // Step 4: Validate lesson unit metadata exists
        if (!data?.lessonUnitsMeta) {
          console.warn('[notebook-details.ts][3006] › No lesson units metadata for file:', fileId);
          continue;
        }
        
        // Step 5: Extract and validate lesson units with type safety
        const lessonUnits = extractLessonUnits(data.lessonUnitsMeta);
        
        if (lessonUnits.length === 0) {
          console.warn('[notebook-details.ts][3007] › No valid lesson units found for file:', fileId);
          continue;
        }
        
        // Step 6: Convert Firestore data to NotebookMeta format with proper typing
        const notebookMeta: NotebookMeta = {
          fileId: docSnapshot.id,
          filePath: data.fileStoragePath || '',
          fileName: data.fileName || 'Untitled',
          lessonUnits: lessonUnits, // Now properly typed as LessonUnit[]
          lastUpdated: data.lessonUnitsMeta.lastUpdated?.toDate() || new Date(),
          version: data.lessonUnitsMeta.version || '1.0',
          color: undefined,
        };
        
        notebooks.push(notebookMeta);
        console.log('[notebook-details.ts][3008] › Loaded notebook:', notebookMeta.fileName, 'with', notebookMeta.lessonUnits.length, 'units');
        
      } catch (fileError) {
        console.error('[notebook-details.ts][3009] › Error loading file:', fileId, fileError);
        continue;
      }
    }

    console.log('[notebook-details.ts][3010] › Successfully loaded', notebooks.length, 'notebooks');

    // Step 7: Return notebook details
    return res.status(200).json({ notebooks });

  } catch (error) {
    console.error('[notebook-details.ts][3018] › Error processing notebook details request:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}