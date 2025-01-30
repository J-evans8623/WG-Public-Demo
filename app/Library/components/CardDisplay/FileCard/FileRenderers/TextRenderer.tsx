// components/FileRenderers/TextRenderer.tsx

import React from 'react';
import type { TextRendererProps } from './types';

export const TextRenderer: React.FC<TextRendererProps> = ({ textContent, onError }) => {
  try {
    return (
      <pre className="text-renderer">
        {textContent}
      </pre>
    );
  } catch (error) {
    onError(error as Error);
    return <div>Error rendering text content.</div>;
  }
};
