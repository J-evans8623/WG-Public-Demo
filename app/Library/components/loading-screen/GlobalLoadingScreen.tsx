// GlobalLoadingScreen.tsx

import React from 'react';
import './GlobalLoadingScreen.css'; // Import CSS for styling

const GlobalLoadingScreen: React.FC = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white z-max">
    <div className="spinner"></div>
    <span className="loading-text">Loading...</span>
  </div>
);

export default GlobalLoadingScreen;
