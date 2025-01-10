import React from 'react';
import './StatusBar.css'

const StatusBar: React.FC = () => {
  return (
    <div className="status-bar">
      <span className="status-message">Ready</span>
    </div>
  );
};

export default StatusBar;
