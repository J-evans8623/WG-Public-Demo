/**
 * @file services/TextPreprocessing/LessonModuleTypes.ts
 * @description
 *   Defines the TypeScript interfaces for hierarchical nodes (PrimaryNode) and
 *   the finalized lesson module structure (LessonModuleV3).
 *   Used throughout the Phase 2 pipeline to shape and type-check lesson data.
 */

import { SyllabusRating, UnitSyllabus } from "./aiTextPreProcessingV3";

/**
 * PrimaryNode
 * Represents one node in the concept-map hierarchy, with its text excerpt.
 * - node_id: Original identifier from the clustering service.
 * - unit_text: The concatenated text for this node.
 * - title: Populated by syllabus merge (Phase 2); undefined until then.
 * - depth2_subtopics: Optional array of nested NodeStubs for second-level subtopics.
 */
export interface PrimaryNode {
  node_id: string;
  unit_text: string; // unit text goes here
  title?: string; // primary subtopic title goes here
  Learning_Objectives?:string;
  LessonOutline?:string;
  depth2_subtopics?: secondaryNode[]; // secondary topic goes here
  lessonOrder?: rank
}

export interface secondaryNode {
  title:string
  LessonOutline: string;
  Learning_Objectives: string;
}


export interface unit {
  unit_id: number;
  unit_text : string
}

/**
 * LessonModuleV3
 * Final shaped object returned by processDocument after Phase 2:
 * - file_id: Identifier for the source document segment.
 * - main_title: The syllabus-generated main title.
 * - introduction: The syllabus-generated introduction.
 * - learning_objective: The syllabus-generated learning objective.
 * - hierarchy: An array of top-level NodeStubs, each with nested depth-2 subtopics and titles filled.
 */
export interface LessonModuleV3 {
  file_id: string;
  main_title: string;
  introduction: string;
  learning_objective: string;
  hierarchy: PrimaryNode[];
}


export type rank = 'A' | 'B' | 'C' ;
/**
 * UnitContext
 * Tracks one “unit” of the full text through all three passes:
 *  - unit_id       : numeric ID (0,1,2)
 *  - unit_text     : the slice of the fullText
 *  - syllabus      : filled in after Pass 1
 *  - rating        : filled in after Pass 2
 *  - prunedStubs   : the NodeStubs built in Pass 2.5
 */
export interface UnitContext {
  unit_id: number; // A | B | C
  unit_text: string;
  syllabus?: UnitSyllabus;
  rating?: SyllabusRating;
  prunedStubs?: PrimaryNode[];
  order?: rank;
}