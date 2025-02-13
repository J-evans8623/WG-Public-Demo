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
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 h-8 w-8 p-0"
        >
          <MoreVertical className="h-[0.75rem] w-[0.75rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          <Trash2 className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
          Delete
        </DropdownMenuItem>
        {resourceType !== 'quiz' && (
          <DropdownMenuItem onClick={onAskAI}>
            <MessageCircle className="h-[0.75rem] w-[0.75rem] mr-[0.375rem]" />
            Ask AI
          </DropdownMenuItem>
        )}
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