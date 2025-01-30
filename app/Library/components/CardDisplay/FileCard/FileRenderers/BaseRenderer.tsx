// FileRenderers/BaseRenderer.tsx
export interface BaseRendererProps {
  content: string;
  pageNumber: number;
  isLoading: boolean;
  onError: (error: Error) => void;
  children?: React.ReactNode; // Add this line to fix the error
}

export const BaseRenderer: React.FC<BaseRendererProps> = ({
  content,
  pageNumber,
  isLoading,
  onError,
  children
}) => {
  return (
    <div className="renderer-container">
      {isLoading ? (
        <div className="loading-state">Loading page {pageNumber}...</div>
      ) : (
        children
      )}
    </div>
  );
};

