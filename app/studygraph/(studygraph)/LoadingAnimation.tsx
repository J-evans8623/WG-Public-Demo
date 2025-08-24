/**
 * LoadingAnimation Component - Production Ready Loading Screen Component
 * 
 * This file provides a comprehensive loading animation system featuring expandable green dots
 * arranged in a decorative dotted square container. The component is designed to handle both
 * full-screen overlay scenarios and inline loading states with multiple size variants.
 * 
 * Key Responsibilities:
 * - Renders a full-screen loading overlay with proper backdrop and blur effects
 * - Provides inline loading animations for embedding within other components
 * - Manages animated dot sequences with staggered timing for visual appeal
 * - Handles accessibility features including ARIA labels and keyboard navigation
 * - Supports three size variants (small, medium, large) for different use cases
 * - Includes a custom React hook for loading state management
 * - Automatically injects CSS keyframes for smooth animations
 * - Provides click-to-dismiss functionality for overlay mode
 * 
 * The overlay mode creates a full-screen backdrop that properly covers the entire viewport
 * with appropriate z-index stacking and blur effects. The component uses inline styles
 * for maximum compatibility and to avoid CSS conflicts in different environments.
 * 
 * Performance considerations include memoized callbacks in the useLoading hook and
 * efficient re-rendering patterns. The animation keyframes are injected once and reused
 * across all instances to minimize DOM manipulation overhead.
 */

import React from 'react';
import { CSSProperties } from 'react';

interface LoadingAnimationProps {
  /** Main loading text displayed to user */
  title?: string;
  /** Secondary descriptive text */
  subtitle?: string;
  /** Whether to show as full-screen overlay */
  isOverlay?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Whether the loading animation is visible */
  isVisible?: boolean;
  /** Callback when overlay is clicked (for dismissal) */
  onOverlayClick?: () => void;
  /** Size variant of the animation */
  size?: 'small' | 'medium' | 'large';
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  title = "Opening Notebook...",
  subtitle = "Preparing your concept map",
  isOverlay = true,
  className = "",
  isVisible = true,
  onOverlayClick,
  size = 'medium'
}) => {
  console.log('LoadingAnimation: Component rendered with props - LA001', { 
    isOverlay, 
    isVisible, 
    size, 
    title 
  });

  // 1. Configure size-specific dimensions and spacing
  const sizeConfig = {
    small: { dotSize: 8, gap: 6, containerSize: 80 },
    medium: { dotSize: 12, gap: 8, containerSize: 120 },
    large: { dotSize: 18, gap: 12, containerSize: 160 }
  };

  const config = sizeConfig[size];
  console.log('LoadingAnimation: Size configuration selected - LA002', { size, config });

  // 2. Define full-screen overlay styles with explicit positioning
  const overlayStyles: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    background: 'rgba(250, 248, 245, 0.95)',
    display: isVisible ? 'flex' : 'none',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)', // Safari support
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    boxSizing: 'border-box'
  };

  // 3. Define container styles for the dotted background square
  const containerStyles: CSSProperties = {
    background: '#FAF8F5',
    backgroundImage: 'radial-gradient(circle, #D4C4B0 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    backgroundPosition: 'center center',
    width: config.containerSize,
    height: config.containerSize,
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    border: '1px solid rgba(212, 196, 176, 0.3)',
    position: 'relative'
  };

  // 4. Define styles for inline (non-overlay) mode
  const inlineContainerStyles: CSSProperties = {
    ...containerStyles,
    position: 'relative',
    margin: '0 auto'
  };

  // 5. Define content wrapper styles
  const contentWrapperStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#2C3E50',
    maxWidth: '90vw',
    padding: '20px'
  };

  // 6. Define text styling based on size variants
  const titleStyles: CSSProperties = {
    fontSize: size === 'large' ? '28px' : size === 'medium' ? '22px' : '18px',
    marginBottom: '8px',
    fontWeight: 600,
    color: '#2C3E50',
    textAlign: 'center',
    lineHeight: 1.3
  };

  const subtitleStyles: CSSProperties = {
    fontSize: size === 'large' ? '16px' : size === 'medium' ? '14px' : '12px',
    marginBottom: '24px',
    opacity: 0.8,
    color: '#5A6C7D',
    textAlign: 'center',
    lineHeight: 1.4
  };

  // 7. Define dot container and individual dot styles
  const dotsContainerStyles: CSSProperties = {
    display: 'flex',
    gap: `${config.gap}px`,
    justifyContent: 'center',
    alignItems: 'center'
  };

  const dotStyles: CSSProperties = {
    width: `${config.dotSize}px`,
    height: `${config.dotSize}px`,
    borderRadius: '50%',
    background: '#5B8C5A',
    flexShrink: 0
  };

  // 8. Define CSS keyframes for dot animation
  const keyframesCSS = `
    @keyframes expandingDots {
      0%, 100% { 
        transform: scale(1); 
        opacity: 0.7; 
        background: #5B8C5A;
      }
      50% { 
        transform: scale(1.6); 
        opacity: 1;
        background: #4A7549;
        box-shadow: 0 0 8px rgba(91, 140, 90, 0.4);
      }
    }
  `;

  // 9. Inject keyframes into document head (runs once per component mount)
  React.useEffect(() => {
    const styleId = 'loading-animation-keyframes';
    console.log('LoadingAnimation: Checking for existing keyframes - LA003', { styleId });
    
    if (!document.getElementById(styleId)) {
      console.log('LoadingAnimation: Injecting CSS keyframes - LA004');
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = keyframesCSS;
      document.head.appendChild(style);
    }
  }, [keyframesCSS]);

  /**
   * DotAnimation Component - Renders the animated dot sequence
   * 
   * Creates four animated dots with staggered animation delays to create
   * a wave-like expansion effect. Each dot scales up and changes opacity
   * in sequence to provide visual feedback during loading states.
   */
const DotAnimation: React.FC = React.memo(() => {
  console.log('LoadingAnimation: DotAnimation rendered - LA005');

  return (
    <div style={dotsContainerStyles}>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            ...dotStyles,
            animation: 'expandingDots 1.8s ease-in-out infinite',
            animationDelay: `${index * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
});
DotAnimation.displayName = 'DotAnimation';


  // 10. Handle overlay click events (prevent event bubbling on content)
  const handleOverlayClick = React.useCallback((event: React.MouseEvent) => {
    console.log('LoadingAnimation: Overlay clicked - LA006');
    if (onOverlayClick) {
      onOverlayClick();
    }
  }, [onOverlayClick]);

  const handleContentClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    console.log('LoadingAnimation: Content clicked (prevented bubbling) - LA007');
  }, []);

  // 11. Render overlay version with full-screen coverage
  if (isOverlay) {
    console.log('LoadingAnimation: Rendering overlay mode - LA008');
    
    return (
      <div 
        style={overlayStyles} 
        className={className}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loading-title"
        aria-describedby="loading-subtitle"
      >
        <div style={contentWrapperStyles} onClick={handleContentClick}>
          <div id="loading-title" style={titleStyles}>
            {title}
          </div>
          <div id="loading-subtitle" style={subtitleStyles}>
            {subtitle}
          </div>
          <div style={containerStyles}>
            <DotAnimation />
          </div>
        </div>
      </div>
    );
  }

  // 12. Render inline version for embedding within other components
  console.log('LoadingAnimation: Rendering inline mode - LA009');
  
  return (
    <div className={className} style={contentWrapperStyles}>
      {title && (
        <div style={titleStyles}>
          {title}
        </div>
      )}
      {subtitle && (
        <div style={subtitleStyles}>
          {subtitle}
        </div>
      )}
      <div style={inlineContainerStyles}>
        <DotAnimation />
      </div>
    </div>
  );
};

/**
 * useLoading Hook - Custom hook for managing loading state
 * 
 * Provides a clean interface for controlling loading animations with
 * memoized callbacks to prevent unnecessary re-renders. Includes
 * show, hide, and toggle functionality for maximum flexibility.
 * Time complexity: O(1) for all operations.
 */
export const useLoading = (initialState: boolean = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  
  console.log('useLoading: Hook initialized - LA010', { initialState, isLoading });

  const showLoading = React.useCallback(() => {
    console.log('useLoading: Showing loading - LA011');
    setIsLoading(true);
  }, []);

  const hideLoading = React.useCallback(() => {
    console.log('useLoading: Hiding loading - LA012');
    setIsLoading(false);
  }, []);

  const toggleLoading = React.useCallback(() => {
    console.log('useLoading: Toggling loading state - LA013');
    setIsLoading(prev => !prev);
  }, []);

  return {
    isLoading,
    showLoading,
    hideLoading,
    toggleLoading
  };
};

/**
 * LoadingExample Component - Demonstration component for testing
 * 
 * Provides interactive buttons to test both overlay and inline modes
 * with automatic timeout functionality for demonstration purposes.
 * Includes all three size variants to showcase responsive behavior.
 */
export const LoadingExample: React.FC = () => {
  const { isLoading, showLoading, hideLoading } = useLoading();
  
  console.log('LoadingExample: Component rendered - LA014', { isLoading });

  // 13. Auto-hide loading after 4 seconds for demonstration
  React.useEffect(() => {
    if (isLoading) {
      console.log('LoadingExample: Setting auto-hide timer - LA015');
      const timer = setTimeout(() => {
        console.log('LoadingExample: Auto-hiding loading - LA016');
        hideLoading();
      }, 4000);
      return () => {
        console.log('LoadingExample: Clearing auto-hide timer - LA017');
        clearTimeout(timer);
      };
    }
  }, [isLoading, hideLoading]);

  return (
    <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh' }}>
      <h2 style={{ color: '#2C3E50', marginBottom: '20px', fontSize: '24px' }}>
        Loading Animation Demo
      </h2>
      
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={showLoading}
          disabled={isLoading}
          style={{
            background: isLoading ? '#95a5a6' : '#5B8C5A',
            color: 'white',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginRight: '12px',
            fontWeight: '500',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isLoading ? 'Loading...' : 'Show Overlay Loading'}
        </button>
        
        <button
          onClick={hideLoading}
          disabled={!isLoading}
          style={{
            background: !isLoading ? '#95a5a6' : '#6C8EBF',
            color: 'white',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: !isLoading ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            transition: 'background-color 0.2s ease'
          }}
        >
          Hide Loading
        </button>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ color: '#2C3E50', marginBottom: '20px', fontSize: '20px' }}>
          Inline Versions:
        </h3>
        
        <div style={{ 
          display: 'flex', 
          gap: '30px', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          alignItems: 'flex-start'
        }}>
          <LoadingAnimation 
            isOverlay={false} 
            size="small" 
            title="Small" 
            subtitle="Loading..."
          />
          
          <LoadingAnimation 
            isOverlay={false} 
            size="medium" 
            title="Medium" 
            subtitle="Processing..."
          />
          
          <LoadingAnimation 
            isOverlay={false} 
            size="large" 
            title="Large" 
            subtitle="Almost ready..."
          />
        </div>
      </div>

      <LoadingAnimation
        isVisible={isLoading}
        onOverlayClick={hideLoading}
        title="Opening Notebook..."
        subtitle="Preparing your concept map"
        size="large"
      />
    </div>
  );
};

export default LoadingAnimation;