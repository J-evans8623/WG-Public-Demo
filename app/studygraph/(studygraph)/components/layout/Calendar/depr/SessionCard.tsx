/**
 * @file SessionCard.tsx
 * @description
 *   Enhanced reusable component for displaying individual study session information with proper file switching
 *   integration through AppLayout's handleFileSelect pattern and comprehensive support for new StudySession
 *   properties including timeSlot indicators and color-coded notebook identification. This component ensures
 *   consistent session presentation while maintaining proper separation of concerns by delegating file management
 *   to the application-level file selection system. The implementation handles enhanced session metadata display,
 *   loading states, and user interactions while coordinating with the calendar context for session launching
 *   through the established file selection workflow. The component provides clear visual distinction between
 *   different session types using color coding, timeSlot indicators, and accessibility features throughout
 *   the user interaction flow. Enhanced features include notebook color indicators, time slot visual cues,
 *   and comprehensive session metadata display for improved user experience and calendar system integration.
 *
 * Responsibilities:
 *   - Display comprehensive study session information with enhanced metadata
 *   - Handle session launching through proper file selection workflow integration
 *   - Show visual indicators for session types, time slots, and notebook colors
 *   - Provide loading states and user feedback during session launch process
 *   - Maintain accessibility standards and responsive design principles
 *   - Support new StudySession interface properties including timeSlot and color
 *   - Coordinate with calendar context for session metadata and launch functionality
 *   - Display duration estimates, topic coverage, and session type information
 */

import React, { useCallback, useState } from 'react';
import { Play, Clock, BookOpen, Users, Sun, Sunset, Moon } from 'lucide-react';
import { StudySession, PickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';

interface SessionCardProps {
  session: StudySession;
  onFileSelect: (meta: PickerFileMeta) => void; // AppLayout's handleFileSelect
  icon: React.ReactNode;
  colors: {
    border: string;
    background: string;
    text: string;
    badge: string;
  };
}

/**
 * Enhanced individual session card component that displays comprehensive session metadata
 * and provides launch functionality through proper file selection workflow. Coordinates with
 * calendar context while maintaining separation of concerns and supporting new interface properties.
 */
const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onFileSelect,
  icon,
  colors,
}) => {
  console.log('[SessionCard.tsx][5001] › Rendering enhanced session card for:', session.id);

  // Step 1: Access calendar context for session launching functionality
  const { createSessionLauncher } = useCalendar();

  // Step 2: Initialize local state for enhanced loading management
  const [isLaunching, setIsLaunching] = useState(false);
  const { requestSessionLaunch } = useSlideShow();

  /**
   * Enhanced session launch handler that coordinates file switching and session content generation.
   * Handles the complete session launch workflow including metadata creation, slideshow coordination,
   * and file selection delegation while providing comprehensive error handling and user feedback.
   */
  const handleLaunch = useCallback(async () => {
    console.log('[SessionCard.tsx][5002] › Launching enhanced session:', session.id);
    
    setIsLaunching(true);
    
    try {
      // Step 1: Create enhanced session launcher metadata with validation
      const pickerMeta = createSessionLauncher(session.id);
      
      if (!pickerMeta) {
        console.error('[SessionCard.tsx][5003] › Failed to create session launcher metadata');
        return;
      }
      
      // Step 2: Request session launch coordination with SlideShow context
      console.log('[SessionCard.tsx][5004] › Requesting enhanced session content generation');
      requestSessionLaunch({
        sessionId: session.id,
        sessionData: session,
        targetFileId: session.notebookMeta.fileId
      });
      
      // Step 3: Delegate file switching to AppLayout with enhanced metadata
      console.log('[SessionCard.tsx][5005] › Switching to target file:', pickerMeta.fileName);
      onFileSelect(pickerMeta);
      
      console.log('[SessionCard.tsx][5006] › Enhanced session launch process initiated successfully');
      
    } catch (error) {
      console.error('[SessionCard.tsx][5007] › Error launching enhanced session:', error);
    } finally {
      setIsLaunching(false);
    }
  }, [session, createSessionLauncher, onFileSelect, requestSessionLaunch]);

  /**
   * Formats session type for enhanced display with proper capitalization and spacing.
   * Converts internal session type identifiers into user-friendly labels that clearly
   * communicate the nature and purpose of each session type with enhanced descriptions.
   */
  const formatSessionType = useCallback((type: string) => {
    switch (type) {
      case 'block':
        return 'Learning Session';
      case 'revision-block':
        return 'Focused Review';
      case 'revision-interleaved':
        return 'Mixed Review';
      default:
        return 'Study Session';
    }
  }, []);

  /**
   * Enhanced duration formatting with intelligent unit selection and accessibility.
   * Converts duration minutes into human-readable format with proper pluralization
   * and unit selection for clear time expectations and improved user experience.
   */
  const formatDuration = useCallback((minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      if (remainingMinutes === 0) {
        return `${hours} hr${hours !== 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  }, []);

  /**
   * Enhanced topic title formatting with intelligent truncation and accessibility.
   * Ensures session cards maintain consistent layout even with long topic titles
   * while providing enough information for identification and user decision making.
   */
  const formatTopics = useCallback((topics: string[], maxLength: number = 60) => {
    const joined = topics.join(', ');
    
    if (joined.length <= maxLength) {
      return joined;
    }
    
    return joined.substring(0, maxLength) + '...';
  }, []);

  /**
   * Gets appropriate time slot icon with enhanced visual representation.
   * Provides intuitive visual cues for different time periods to help users
   * quickly identify session scheduling and plan their daily study activities.
   */
const getTimeSlotIcon = useCallback((timeSlot?: string) => {
  switch (timeSlot) {
    case 'morning':
      return (
        <span title="Morning session" className="inline-flex">
          <Sun size={12} className="text-yellow-500" aria-hidden="true" />
        </span>
      );
    case 'afternoon':
      return (
        <span title="Afternoon session" className="inline-flex">
          <Sunset size={12} className="text-orange-500" aria-hidden="true" />
        </span>
      );
    case 'evening':
      return (
        <span title="Evening session" className="inline-flex">
          <Moon size={12} className="text-purple-500" aria-hidden="true" />
        </span>
      );
    default:
      return null;
  }
}, []);


  /**
   * Gets enhanced notebook color with proper fallback handling and accessibility.
   * Ensures consistent visual presentation across different notebook states and
   * provides accessible color schemes for enhanced user experience and identification.
   */
  const getNotebookColor = useCallback(() => {
    return session.notebookMeta.color || '#6B7280'; // Default gray if no color assigned
  }, [session.notebookMeta.color]);

  return (
    <div
      className={`p-4 border-2 rounded-lg transition-all hover:shadow-md ${colors.border} ${colors.background} relative`}
    >
      
      {/* Step 3: Enhanced Session Header with Color and Time Indicators */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Enhanced notebook color indicator */}
          <div 
            className="w-4 h-4 rounded-full border border-gray-200 shadow-sm"
            style={{ backgroundColor: getNotebookColor() }}
            title={`${session.notebookMeta.fileName} color indicator`}
          />
          
          {icon}
          
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors.badge}`}>
            {formatSessionType(session.type)}
          </span>
        </div>
        
        {/* Enhanced launch button with loading states */}
        <button
          onClick={handleLaunch}
          disabled={isLaunching}
          className={`p-2 rounded-full transition-all ${
            isLaunching
              ? 'bg-gray-200 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 shadow-sm hover:shadow-md'
          }`}
          title="Launch study session"
          aria-label={`Launch ${formatSessionType(session.type).toLowerCase()}`}
        >
          {isLaunching ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play size={16} className="text-gray-700" />
          )}
        </button>
      </div>

      {/* Step 4: Enhanced Session Title and Topics */}
      <div className="mb-3">
        <h5 className={`font-medium mb-1 ${colors.text}`}>
          {session.notebookMeta.fileName}
        </h5>
        
        <p className="text-sm text-gray-600 line-clamp-2" title={session.metadata.topicTitles.join(', ')}>
          {formatTopics(session.metadata.topicTitles)}
        </p>
      </div>

      {/* Step 5: Enhanced Session Metadata with Time Slot Support */}
      <div className="space-y-2 text-sm text-gray-600">
        
        {/* Duration, Unit Count, and Time Slot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{formatDuration(session.metadata.estimatedDuration)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{session.sessionConfig.unitCount} topic{session.sessionConfig.unitCount !== 1 ? 's' : ''}</span>
            </div>
            
            {/* Enhanced time slot indicator */}
            {session.timeSlot && getTimeSlotIcon(session.timeSlot)}
          </div>
        </div>

        {/* Enhanced session scheduling information */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>
              {session.date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
          
          {/* Time slot label */}
          {session.timeSlot && (
            <div className="text-xs text-gray-500 capitalize">
              {session.timeSlot}
            </div>
          )}
        </div>

        {/* Enhanced notebook source information */}
        <div className="flex items-center gap-1">
          <BookOpen size={12} />
          <span className="truncate" title={session.notebookMeta.fileName}>
            From: {session.notebookMeta.fileName}
          </span>
        </div>
      </div>

      {/* Step 6: Enhanced Session Description with Type-Specific Information */}
      {session.type === 'block' && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs text-gray-600">
          <strong>Comprehensive Learning:</strong> New material with concept maps, notes, and practice exercises.
        </div>
      )}
      
      {session.type === 'revision-block' && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs text-gray-600">
          <strong>Focused Review:</strong> Targeted flashcards and quizzes from selected topics.
        </div>
      )}
      
      {session.type === 'revision-interleaved' && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs text-gray-600">
          <strong>Mixed Review:</strong> Interleaved practice combining multiple lessons for enhanced retention.
        </div>
      )}

      {/* Step 7: Enhanced Visual Indicators */}
      {/* Time slot position indicator */}
      {session.timeSlot && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border-2 border-gray-200 shadow-sm">
          <div className="w-full h-full rounded-full" style={{
            backgroundColor: session.timeSlot === 'morning' ? '#F59E0B' : 
                           session.timeSlot === 'afternoon' ? '#F97316' : '#8B5CF6'
          }} />
        </div>
      )}
    </div>
  );
};

export default SessionCard;