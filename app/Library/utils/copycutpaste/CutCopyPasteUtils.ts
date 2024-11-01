// bloom-maps/app/Library/utils/copycutpaste/CutCopyPasteUtils.ts

/**
 * Utility functions to manage Cut, Copy, and Paste operations for resources.
 * This file provides a streamlined and efficient implementation of selection management,
 * transfer execution, and paste operations.
 * 
 * These functions are designed to be imported and used within the ToolPaneCutCopyWindow component,
 * interacting with the ResourceContext API methods as needed.
 */

/**
 * Toggles the selection of a resource.
 * If the resourceId is already selected, it removes it.
 * Otherwise, it adds it to the selection.
 *
 * @param resourceId - The ID of the resource to toggle.
 * @param selectedResourceIds - The current array of selected resource IDs.
 * @returns The updated array of selected resource IDs.
 */
export function toggleResourceSelection(
    resourceId: string,
    selectedResourceIds: string[]
  ): string[] {
    if (selectedResourceIds.includes(resourceId)) {
      return selectedResourceIds.filter(id => id !== resourceId);
    } else {
      return [...selectedResourceIds, resourceId];
    }
  }
  
  /**
   * Clears all selected resources.
   *
   * @returns An empty array of selected resource IDs.
   */
  export function clearSelection(): string[] {
    return [];
  }
  
  /**
   * Marks resources for transfer (cut or copy).
   * This function replaces the current selection with the specified resources.
   *
   * @param resourceIds - An array of resource IDs to mark for transfer.
   * @returns An array containing the marked resource IDs.
   */
  export function markForTransfer(resourceIds: string[]): string[] {
    return [...resourceIds];
  }
  
  /**
   * Executes the transfer of resources based on the command.
   * For 'copy', it duplicates the resources to the target node.
   * For 'cut', it moves the resources to the target node.
   *
   * @param sourceNodeId - The ID of the source node.
   * @param targetNodeId - The ID of the target node.
   * @param resourceIds - The IDs of the resources to transfer.
   * @param command - The type of transfer ('copy' or 'cut').
   * @param transferResource - Function to transfer resources.
   */
  function executeTransfer(
    sourceNodeId: string,
    targetNodeId: string,
    resourceIds: string[],
    command: 'copy' | 'cut',
    transferResource: (source: string, target: string, ids: string[], command: 'copy' | 'cut') => void
  ): void {
    transferResource(sourceNodeId, targetNodeId, resourceIds, command);
  }
  
  /**
   * Handles the paste operation by executing the transfer and resetting the selection.
   *
   * @param sourceNodeId - The ID of the source node.
   * @param targetNodeId - The ID of the target node.
   * @param selectedResourceIds - The IDs of the selected resources to be pasted.
   * @param command - The type of operation ('cut' or 'copy').
   * @param transferResource - Function to transfer resources.
   * @returns The updated array of selected resource IDs after the paste operation (empty array).
   */
  export function handlePaste(
    sourceNodeId: string,
    targetNodeId: string,
    selectedResourceIds: string[],
    command: 'cut' | 'copy',
    transferResource: (source: string, target: string, ids: string[], command: 'copy' | 'cut') => void
  ): string[] {
    if (selectedResourceIds.length === 0) {
      return clearSelection();
    }
  
    executeTransfer(sourceNodeId, targetNodeId, selectedResourceIds, command, transferResource);
    return clearSelection();
  }
  