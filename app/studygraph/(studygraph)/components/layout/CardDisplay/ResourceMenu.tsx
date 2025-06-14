// ResourceMenu.tsx

/**
 * @file ResourceMenu.tsx
 * @description
 *   Renders the ellipsis (“More”) dropdown menu for each resource card. Depending on the resource type,
 *   it displays the appropriate action items: Edit, Delete, Ask AI, and Generate Caption.
 *
 *   RESPONSIBILITIES:
 *     - Provide a “ghost” button trigger that opens a dropdown menu.
 *     - Show “Edit” and “Delete” for all non-quiz cards.
 *     - Hide “Edit” (and “Ask AI”) for quiz cards, since quizzes should not be editable by the user.
 *     - Show “Ask AI” only for cuecard, note, or image cards (not quiz cards).
 *     - Show “Generate Caption” only for image cards.
 *
 *   Note: No external styling changes were made—this file preserves all pre-existing Tailwind/CSS classes.
 */

import React from 'react';
import { MoreVertical, Edit, Trash2, MessageCircle, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ResourceMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onImageCaption: () => void;
  resourceType: 'cuecard' | 'note' | 'image' | 'quiz';
}

const ResourceMenu: React.FC<ResourceMenuProps> = ({
  onEdit,
  onDelete,
  onAskAI,
  onImageCaption,
  resourceType,
}) => {
  return (
    <DropdownMenu>
      {/* Button that triggers the dropdown */}
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 h-8 w-8 p-0"
        >
          <MoreVertical className="h-[0.75rem] w-[0.75rem]" />
        </Button>
      </DropdownMenuTrigger>

      {/* Dropdown content: width is fixed at 12rem (w-48) */}
      <DropdownMenuContent align="end" className="w-48">
        {/* Only show “Edit” if this is not a quiz card */}
        {resourceType !== 'quiz' && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
            Edit
          </DropdownMenuItem>
        )}

        {/* “Delete” is always available */}
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          <Trash2 className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
          Delete
        </DropdownMenuItem>

        {/* Only show “Ask AI” for non-quiz cards */}
        {resourceType !== 'quiz' && (
          <DropdownMenuItem onClick={onAskAI}>
            <MessageCircle className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
            Ask AI
          </DropdownMenuItem>
        )}

        {/* Only show “Generate Caption” for image cards */}
        {resourceType === 'image' && (
          <DropdownMenuItem onClick={onImageCaption}>
            <FileImage className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
            Generate Caption
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ResourceMenu;
