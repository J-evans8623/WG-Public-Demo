import React from 'react';

interface DashedRingProps {
  width: number;
  height: number;
  position: { x: number; y: number };
}

const DashedRing: React.FC<DashedRingProps> = ({
  width,
  height,
  position,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width,
        height,
        border: '2px dashed #000',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
};

export default DashedRing;
