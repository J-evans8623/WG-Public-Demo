/**
 * @file app/(welcome)/draft/landingPageB/VideoHeroShot.tsx
 * @description
 * This component renders the framed product demonstration video for the WiseGraph hero section. 
 * It has been refined to utilize an external CSS file for layout control, allowing for 
 * a reduced, more proportionate size that aligns with the site's visual hierarchy. The 
 * component maintains its identity as a premium "monitor" through the 12px burgundy 
 * (#8B0000) border, which now wraps a more constrained and centered video element. 
 * Its primary responsibility is to provide a high-definition, non-interactive visual 
 * anchor that showcases the application's core functionality (the study planner) 
 * without overwhelming the adjacent marketing copy.
 */

import React from 'react';
// update - 2.1: Import the new CSS file for fine-tuned layout control
import './VideoHeroShot.css';

/**
 * VideoHeroShot Function
 * @description
 * Returns the framed video shot within a layout-constrained wrapper. It encapsulates 
 * the 12px burgundy border and the auto-playing WebM asset while applying the 
 * sizing logic defined in the associated .css file.
 * @returns {JSX.Element} The proportionally sized and framed video hero shot.
 */
const VideoHeroShot = () => {
  return (
    /* update - 2.2: Added the wrapper div to implement the 85% width and centering logic */
    <div className="wg-video-hero-wrapper">
      <div 
        className="wg-video-hero-frame relative w-full h-full overflow-hidden rounded-xl" 
        style={{ 
          backgroundColor: '#000000',
          border: '12px solid #000000', 
          boxSizing: 'border-box'
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/brand/hero-shot-highest-res.png" 
          className="w-full h-full object-cover pointer-events-none rounded-sm"
        >
          {/* update - 2.3: Video source remains the trimmed study planner demo */}
          <source 
            src="/demo/life-learner-take-4-trimmed.webm"  
            type="video/webm" 
          />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};

export default VideoHeroShot;