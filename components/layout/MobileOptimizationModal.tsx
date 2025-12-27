import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Monitor, Bookmark } from 'lucide-react';

// We assume modalStyles.css is imported globally or we import it here
// import '@/app/workspace/components/modals/modalStyles.css';

export const MobileOptimizationModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Check if screen width is less than 1024px (Tablets & Mobile)
    // You can adjust this to 768px if you want to allow tablets without warning.
    const checkScreenSize = () => {
      if (window.innerWidth < 1024) {
        // Check if user has already dismissed this in this session
        const hasDismissed = sessionStorage.getItem('wisegraph-mobile-dismissed');
        if (!hasDismissed) {
          setIsOpen(true);
        }
      }
    };

    checkScreenSize();
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('wisegraph-mobile-dismissed', 'true');
  };

  if (!isMounted || !isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-container" style={{ maxWidth: '400px', textAlign: 'center' }}>
        
        {/* Icon Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#5B8C5A' }}>
          <Monitor size={48} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="modal-title" style={{ marginBottom: '16px' }}>
          For the best experience
        </h2>

        {/* Main Text */}
        <p className="modal-text">
          WiseGraph features a visual workspace that works best on larger screens.
        </p>
        
        <p className="modal-text">
          We recommend switching to a <strong>desktop or laptop</strong> for a better learning experience.
        </p>

        {/* Bookmark Tip */}
        <div 
          style={{ 
            backgroundColor: '#FAF8F5', 
            border: '1px solid #D4C4B0', 
            borderRadius: '8px', 
            padding: '12px',
            margin: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2C3E50', fontWeight: 600, fontSize: '14px' }}>
            <Bookmark size={16} />
            <span>Bookmark</span>
          </div>
          <p className="modal-subtext" style={{ margin: 0 }}>
            Bookmark us to easily jump back in.
          </p>
        </div>

        {/* Action Button */}
        <div className="button-section" style={{ justifyContent: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleDismiss}
            style={{ width: '100%' }}
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};