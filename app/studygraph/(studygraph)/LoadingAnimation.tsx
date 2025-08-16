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
  const sizeConfig = {
    small: { dotSize: 8, gap: 6, containerSize: 80 },
    medium: { dotSize: 12, gap: 8, containerSize: 120 },
    large: { dotSize: 18, gap: 12, containerSize: 160 }
  };

  const config = sizeConfig[size];

  const overlayStyles: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(250, 248, 245, 0.95)',
    display: isVisible ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const containerStyles: CSSProperties = {
    background: '#FAF8F5',
    backgroundImage: 'radial-gradient(circle, #D4C4B0 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    width: config.containerSize,
    height: config.containerSize,
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    border: '1px solid #e9ecef'
  };

  const inlineContainerStyles: CSSProperties = {
    ...containerStyles,
    position: 'relative',
    margin: '0 auto'
  };

  const contentStyles: CSSProperties = {
    textAlign: 'center',
    color: '#2C3E50'
  };

  const titleStyles: CSSProperties = {
    fontSize: size === 'large' ? '24px' : size === 'medium' ? '20px' : '16px',
    marginBottom: '10px',
    fontWeight: 600
  };

  const subtitleStyles: CSSProperties = {
    fontSize: size === 'large' ? '16px' : size === 'medium' ? '14px' : '12px',
    marginBottom: '30px',
    opacity: 0.8
  };

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
    background: '#5B8C5A'
  };

  const keyframesCSS = `
    @keyframes expandingDots {
      0%, 100% { 
        transform: scale(1); 
        opacity: 0.7; 
      }
      50% { 
        transform: scale(1.5); 
        opacity: 1; 
      }
    }
  `;

  // Inject keyframes if not already present
  React.useEffect(() => {
    const styleId = 'loading-animation-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = keyframesCSS;
      document.head.appendChild(style);
    }
  }, []);

  const DotAnimation: React.FC = () => (
    <div style={dotsContainerStyles}>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            ...dotStyles,
            animation: 'expandingDots 1.5s ease-in-out infinite',
            animationDelay: `${index * 0.2}s`
          }}
        />
      ))}
    </div>
  );

  if (isOverlay) {
    return (
      <div 
        style={overlayStyles} 
        className={className}
        onClick={onOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loading-title"
        aria-describedby="loading-subtitle"
      >
        <div style={contentStyles} onClick={(e) => e.stopPropagation()}>
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

  return (
    <div className={className} style={contentStyles}>
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

// Hook for managing loading state
export const useLoading = (initialState: boolean = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);

  const showLoading = React.useCallback(() => {
    setIsLoading(true);
  }, []);

  const hideLoading = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const toggleLoading = React.useCallback(() => {
    setIsLoading(prev => !prev);
  }, []);

  return {
    isLoading,
    showLoading,
    hideLoading,
    toggleLoading
  };
};

// Example usage component
export const LoadingExample: React.FC = () => {
  const { isLoading, showLoading, hideLoading } = useLoading();

  React.useEffect(() => {
    // Auto-hide after 3 seconds for demo
    if (isLoading) {
      const timer = setTimeout(hideLoading, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hideLoading]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2 style={{ color: '#2C3E50', marginBottom: '20px' }}>
        Loading Animation Demo
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={showLoading}
          style={{
            background: '#5B8C5A',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Show Overlay Loading
        </button>
        
        <button
          onClick={hideLoading}
          style={{
            background: '#6C8EBF',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Hide Loading
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#2C3E50', marginBottom: '15px' }}>Inline Versions:</h3>
        
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
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