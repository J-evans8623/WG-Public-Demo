// src/app/studygraph/(studygraph)/components/layout/CardDisplay/types/resourceForm.ts

/**
 * @file resourceForm.ts
 * @description
 *   Shared interface for all resource‐form inputs:
 *   • selectedTopicId: ID of an existing node to attach the card to.
 *   • createNode: whether to create a brand‐new node.
 *   • nodeTitle: title for that new node, if createNode=true.
 *   • file: optional File for image resources.
 *
 *   This centralizes the contract between CardDisplay → EditTab → ResourceDisplay
 *   so that on Save(), all required fields are guaranteed present.
 */

export interface ResourceFormInput {
    selectedTopicId: string;
    createNode: boolean;
    nodeTitle: string;
    file?: File;
  }
  