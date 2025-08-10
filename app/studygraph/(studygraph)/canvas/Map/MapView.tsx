import React from 'react';

// This wrapper only provides the background + container classes.
// It renders your existing graph/nodes as children.
type Props = { children?: React.ReactNode };

const MapView: React.FC<Props> = ({ children }) => {
  return (
    <div className="map-container">
      <div className="map-background-pattern" />
      {children}
    </div>
  );
};

export default MapView;
