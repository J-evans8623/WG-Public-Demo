import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import SafeContent from '../../../utils/SafeContent';

interface CueCardProps {
  topicTitle: string;
  title: string;
  content: string;
}

const CueCard: React.FC<CueCardProps> = ({ topicTitle, title, content }) => {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    setFlipped(prev => !prev);
  };

  return (
    <div
      className="cursor-pointer transition-transform duration-300 py-[1.125rem]"
      onClick={handleFlip}
    >
      {flipped ? (
        <div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-sky-100 text-sky-700 border-sky-200">
                Cue Card
              </Badge>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {topicTitle}
              </span>
            </div>
            <div className="mt-1 h-px bg-gray-200 ml-[calc(4rem_+_0.5625rem)]" />
          </div>
          <div className="mt-6">
            <SafeContent
              html={content}
              className="prose text-gray-700 text-base leading-relaxed tracking-normal"
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-sky-100 text-sky-700 border-sky-200">
                Cue Card
              </Badge>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {topicTitle}
              </span>
            </div>
            <div className="mt-1 h-px bg-gray-200 ml-[calc(4rem_+_0.5625rem)]" />
          </div>
          <h3 className="font-medium text-xl mt-6 text-gray-900 leading-relaxed text-center">
            {title}
          </h3>
        </div>
      )}
    </div>
  );
};

export default CueCard;
