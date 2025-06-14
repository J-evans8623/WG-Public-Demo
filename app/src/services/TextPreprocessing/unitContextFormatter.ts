/**
 * @file unitContextFormatter.ts
 * @description
 *   Formats an array of UnitContext (with string unit_id keys)
 *   into one concatenated string, wrapping each unit’s text between
 *   “#### Start of Unit X ####” and “#### End of Unit X ####”.
 */

import { UnitSyllabus } from "./aiTextPreProcessingV3";
import { SyllabusRating } from "./aiTextPreProcessingV4";
import { PrimaryNode } from "./LessonModuleTypes";

export interface UnitContext {
  unit_id: string; // A | B | C
  unit_text: string;
  syllabus?: UnitSyllabus;
  rating?: SyllabusRating;
  prunedStubs?: PrimaryNode[];
}


export function formatUnitContexts(contexts: UnitContext[]): string {
  return contexts
    .map(ctx => {
      const key = ctx.unit_id;  // already 'A' | 'B' | 'C'
      return [
        `#### Start of Unit ${key}, the key for this unit is : ${key} ####`,
        '',
        ctx.unit_text,
        '',
        `#### End of Unit ${key} ####`
      ].join('\n');
    })
    .join('\n\n');  // blank line between units
}
