import React from 'react';
import { Badge } from '@/components/ui/badge';
import SafeContent from '../../../utils/SafeContent';

export interface NoteCardProps {
  topicTitle: string;
  title: string;
  content: string;
}

const NoteCard: React.FC<NoteCardProps> = ({ topicTitle, title, content }) => {
  return (
    <div className="py-[1.125rem]">
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-teal-100 text-teal-700 border-teal-200">
              Note
            </Badge>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {topicTitle}
            </span>
          </div>
        </div>
        <div className="mt-1 h-px bg-gray-200 ml-[calc(4rem_+_0.5625rem)]" />
      </div>

      <h3 className="font-medium text-xl mt-6 text-gray-900 leading-relaxed text-center">
        {title}
      </h3>

      <div className="mt-6">
        <SafeContent
          html={content}
          className="prose text-gray-700 text-base leading-relaxed tracking-normal line-clamp-4"
        />
      </div>
    </div>
  );
};

export default NoteCard;