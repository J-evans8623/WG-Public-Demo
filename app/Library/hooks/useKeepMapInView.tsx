// bloom-maps/app/Library/hooks/useKeepMapInView.tsx

import { useEffect } from 'react';

interface UseKeepMapInViewProps {
  mapRef: React.RefObject<HTMLDivElement>;
  centerPaneRef: React.RefObject<HTMLDivElement>;
  zoomLevel: number;
}

const useKeepMapInView = ({
  mapRef,
  centerPaneRef,
  zoomLevel,
}: UseKeepMapInViewProps) => {
  useEffect(() => {
    if (!mapRef.current || !centerPaneRef.current) return;

    const centerPane = centerPaneRef.current;
    const map = mapRef.current;
    const width: number = map.offsetWidth;
    const height: number = map.offsetHeight;

    const adjustScroll = () => {
      const centerRect = centerPane.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();

      // Calculate the scaled dimensions of the map
      const scaledWidth = width * zoomLevel;
      const scaledHeight = height * zoomLevel;

      // If the map is smaller than the container, center it
      if (scaledWidth < centerRect.width) {
        const scrollLeft = (scaledWidth - centerRect.width) / 2;
        centerPane.scrollLeft = scrollLeft;
      } else {
        // Ensure scrollLeft is within valid range
        const maxScrollLeft = scaledWidth - centerRect.width;
        if (centerPane.scrollLeft > maxScrollLeft) {
          centerPane.scrollLeft = maxScrollLeft;
        }
      }

      if (scaledHeight < centerRect.height) {
        const scrollTop = (scaledHeight - centerRect.height) / 2;
        centerPane.scrollTop = scrollTop;
      } else {
        const maxScrollTop = scaledHeight - centerRect.height;
        if (centerPane.scrollTop > maxScrollTop) {
          centerPane.scrollTop = maxScrollTop;
        }
      }
    };

    adjustScroll();

    // Adjust on window resize or zoom changes
    window.addEventListener('resize', adjustScroll);
    adjustScroll();

    return () => {
      window.removeEventListener('resize', adjustScroll);
    };
  }, [mapRef, centerPaneRef, zoomLevel]);
};

export default useKeepMapInView;
/**
 * Original
 * 
 */