import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AutoSaveService, { AutoSaveConfig } from '../services/autoSaveService';
import { AuthContext } from '@/app/src/context/AuthContext'
import { useFileContext } from '@/app/Library/Context/FileProvider';
/**
 * Interface defining the shape of the AutoSave context
 */
interface AutoSaveContextType {
  isEnabled: boolean;
  interval: number;
  lastSaveTime: Date | null;
  isSaving: boolean;
  enable: () => void;
  disable: () => void;
  setInterval: (seconds: number) => void;
  status: 'idle' | 'saving' | 'error';
  error: string | null;
}

const AutoSaveContext = createContext<AutoSaveContextType | undefined>(undefined);

/**
 * Custom hook to use the AutoSave context
 */
export const useAutoSave = () => {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error('useAutoSave must be used within an AutoSaveProvider');
  }
  return context;
};

interface AutoSaveProviderProps {
  children: React.ReactNode;
  defaultInterval?: number;
}

/**
 * Provider component that manages automatic saving functionality
 */
export const AutoSaveProvider: React.FC<AutoSaveProviderProps> = ({
  children,
  defaultInterval = 30, // 30 seconds default
}) => {
    const { isAuthenticated, user} = useContext(AuthContext); //   
  const { fileName, dispatch } = useFileContext();
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [interval, setIntervalValue] = useState(defaultInterval);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Configures the AutoSaveService when enabled/disabled or interval changes
   */
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsEnabled(false);
      return;
    }

    AutoSaveService.configure({
      enabled: isEnabled,
      interval: interval * 1000, // Convert to milliseconds
      fileId: fileName // Assuming fileName is being used as fileId for now
    });

    return () => {
      AutoSaveService.configure({ enabled: false });
    };
  }, [isEnabled, interval, isAuthenticated, user, fileName]);

  /**
   * Handler for successful saves
   */
  const handleSaveSuccess = useCallback(() => {
    setLastSaveTime(new Date());
    setStatus('idle');
    setError(null);
    setIsSaving(false);
  }, []);

  /**
   * Handler for save failures
   */
  const handleSaveError = useCallback((error: Error) => {
    setStatus('error');
    setError(error.message);
    setIsSaving(false);
  }, []);

  /**
   * Enable autosave functionality
   */
  const enable = useCallback(() => {
    if (!isAuthenticated) {
      setError('Must be signed in to use autosave');
      return;
    }
    setIsEnabled(true);
    setError(null);
  }, [isAuthenticated]);

  /**
   * Disable autosave functionality
   */
  const disable = useCallback(() => {
    setIsEnabled(false);
    setError(null);
  }, []);

  /**
   * Set the autosave interval
   */
  const setInterval = useCallback((seconds: number) => {
    if (seconds < 10) {
      setError('Interval must be at least 10 seconds');
      return;
    }
    setIntervalValue(seconds);
  }, []);

  const value = {
    isEnabled,
    interval,
    lastSaveTime,
    isSaving,
    status,
    error,
    enable,
    disable,
    setInterval
  };

  return (
    <AutoSaveContext.Provider value={value}>
      {children}
    </AutoSaveContext.Provider>
  );
};

export default AutoSaveProvider;