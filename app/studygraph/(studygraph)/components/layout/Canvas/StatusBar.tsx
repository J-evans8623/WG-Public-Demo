import React from 'react';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

const StatusBar: React.FC = () => {
  const { StatusMessage } = useNodeSelection();

  if (!StatusMessage) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-md shadow-lg z-20">
      {StatusMessage}
    </div>
  );
};

export default StatusBar;
