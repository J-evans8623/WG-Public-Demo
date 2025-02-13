import React, { useState, useCallback, useRef } from 'react';
import { CanvasToolbar } from './CanvasToolBar';
import MapRenderer from './MapRenderer';
import { PDFRenderer } from './PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import StatusBar from './StatusBar';

interface CanvasViewProps {
  isResourcePanelVisible: boolean;
  onToggleResourcePanel: () => void;
  viewportRef: React.RefObject<HTMLDivElement>;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  isResourcePanelVisible,
  onToggleResourcePanel,
  viewportRef,
}) => {
  const [activeResourceType, setActiveResourceType] = useState<'map' | 'pdf'>('map');
  const { dispatch: zoomDispatch } = useZoomContext();

  const handleZoomIn = useCallback(() => {
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  }, [zoomDispatch]);

  const handleZoomOut = useCallback(() => {
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  }, [zoomDispatch]);

  return (
    <div data-testid="canvas-view" className="flex-1 bg-gray-100 p-6 relative flex flex-col">
      <CanvasToolbar 
        isResourcePanelVisible={isResourcePanelVisible}
        onToggleResourcePanel={onToggleResourcePanel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterMap={() => {
          if (viewportRef.current) {
            const centerEvent = new CustomEvent('centerMap');
            viewportRef.current.dispatchEvent(centerEvent);
          }
        }}
      />

      <div 
        ref={viewportRef}
        className="flex-1 bg-white rounded-lg border border-gray-200 p-4 relative"
      >
        <StatusBar />
        {activeResourceType === 'map' ? (
          <MapRenderer viewportRef={viewportRef} />
        ) : (
          <PDFRenderer />
        )}
      </div>
    </div>
  );
};

export default CanvasView;
