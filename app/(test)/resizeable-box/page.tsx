// pages/resizable-box/page.tsx
import React from 'react';
import ResizableBox from '@/app/(test)/resizeable-box/ResizeableBox';

const ResizableBoxPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <ResizableBox />
    </div>
  );
};

export default ResizableBoxPage;
