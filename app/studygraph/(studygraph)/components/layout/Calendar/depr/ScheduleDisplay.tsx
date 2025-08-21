/**
 * @file ScheduleDisplay.tsx
 * @description
 *   Calendar view component showing generated study sessions with interactive session cards, color coding,
 *   and progress tracking for the BloomMap calendar planner system. This component provides the main
 *   visualization of study schedules with clear session type indicators, metadata display, and one-click
 *   session launching capabilities. The implementation organizes sessions by date, provides visual
 *   distinction between different session types (block, revision-block, revision-interleaved), and
 *   includes progress tracking for completed sessions. The component handles empty states, loading
 *   conditions, and error scenarios while maintaining responsive design and accessibility standards.
 *   Session cards display comprehensive metadata including notebook source, topic coverage, estimated
 *   duration, and session type with appropriate visual cues. The interface supports session launching
 *   through calendar context integration and provides user feedback for all interactive elements
 *   following established BloomMap design patterns and user experience standards.
 */

import React, { useMemo, useCallback } from 'react';
import { Calendar, Clock, BookOpen, Play, RotateCcw, Shuffle } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { PickerFileMeta, StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import SessionCard from './SessionCard';


interface ScheduleDisplayProps {
  onFileSelect?: (meta: PickerFileMeta) => void; // AppLayout's handleFileSelect function
}


/**
 * Main schedule display component that organizes and renders study sessions
 * in a calendar-like format with grouping by date and proper visual hierarchy.
 * Provides comprehensive session management and launching capabilities.
 */
const ScheduleDisplay:  React.FC<ScheduleDisplayProps> = ({ onFileSelect })=> {
  console.log('[ScheduleDisplay.tsx][9001] › Rendering schedule display component');

  // Step 1: Access calendar context for schedule data and operations
  const { studySchedule, isLoading, error} = useCalendar();

  /**
   * Groups study sessions by date for organized display in calendar format.
   * Creates a structured view of sessions that makes it easy for users to
   * understand their daily study commitments and plan accordingly.
   */
  const sessionsByDate = useMemo(() => {
    console.log('[ScheduleDisplay.tsx][9002] › Grouping', studySchedule.length, 'sessions by date');

    const grouped = studySchedule.reduce((acc, session) => {
      const dateKey = session.date.toDateString();
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      
      acc[dateKey].push(session);
      return acc;
    }, {} as Record<string, StudySession[]>);

    // Step 2: Sort sessions within each date by time
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    console.log('[ScheduleDisplay.tsx][9003] › Grouped sessions into', Object.keys(grouped).length, 'days');
    return grouped;
  }, [studySchedule]);

  /**
   * Fallback file selection handler that logs a warning if no onFileSelect
   * prop is provided. This ensures the component can render even if not
   * properly integrated with AppLayout's file selection system.
   */
  const handleFileSelect = useCallback((meta: PickerFileMeta) => {
    if (onFileSelect) {
      console.log('[ScheduleDisplay.tsx][9004] › Delegating file selection to AppLayout:', meta.fileName);
      onFileSelect(meta);
    } else {
      console.warn('[ScheduleDisplay.tsx][9005] › No file selection handler provided - session launch disabled');
    }
  }, [onFileSelect]);

  /**
   * Formats date for display in section headers with proper localization.
   * Provides consistent date formatting across the calendar interface
   * while maintaining readability and cultural appropriateness.
   */
  const formatDateHeader = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }, []);

/**
   * Gets appropriate icon for session type to provide visual distinction
   * between different study session types. Helps users quickly identify
   * the nature of each session and plan their study approach accordingly.
   */
  const getSessionIcon = useCallback((sessionType: string) => {
    switch (sessionType) {
      case 'block':
        return <BookOpen size={16} className="text-blue-600" />;
      case 'revision-block':
        return <RotateCcw size={16} className="text-green-600" />;
      case 'revision-interleaved':
        return <Shuffle size={16} className="text-purple-600" />;
      default:
        return <Calendar size={16} className="text-gray-600" />;
    }
  }, []);

  /**
   * Gets color scheme for session type to maintain consistent visual coding
   * throughout the calendar interface. Provides immediate visual feedback
   * about session types and helps users understand their study progression.
   */
  const getSessionColors = useCallback((sessionType: string) => {
    switch (sessionType) {
      case 'block':
        return {
          border: 'border-blue-200',
          background: 'bg-blue-50',
          text: 'text-blue-800',
          badge: 'bg-blue-100 text-blue-800',
        };
      case 'revision-block':
        return {
          border: 'border-green-200',
          background: 'bg-green-50',
          text: 'text-green-800',
          badge: 'bg-green-100 text-green-800',
        };
      case 'revision-interleaved':
        return {
          border: 'border-purple-200',
          background: 'bg-purple-50',
          text: 'text-purple-800',
          badge: 'bg-purple-100 text-purple-800',
        };
      default:
        return {
          border: 'border-gray-200',
          background: 'bg-gray-50',
          text: 'text-gray-800',
          badge: 'bg-gray-100 text-gray-800',
        };
    }
  }, []);

  // Step 3: Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading schedule...</span>
      </div>
    );
  }

  // Step 4: Handle error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">
          <Calendar size={48} className="mx-auto mb-2" />
          <p className="text-lg font-medium">Error Loading Schedule</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Step 5: Handle empty schedule state
  if (studySchedule.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Schedule Generated
        </h3>
        <p className="text-gray-600 mb-4">
          Select notebooks and generate a schedule to see your study sessions here.
        </p>
      </div>
    );
  }

  // Step 6: Render schedule with grouped sessions
  return (
    <div className="space-y-6">
      
      {/* Schedule Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{studySchedule.length}</div>
          <div className="text-sm text-gray-600">Total Sessions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {studySchedule.filter(s => s.type === 'block').length}
          </div>
          <div className="text-sm text-gray-600">Learning Sessions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {studySchedule.filter(s => s.type.includes('revision')).length}
          </div>
          <div className="text-sm text-gray-600">Review Sessions</div>
        </div>
      </div>

      {/* Sessions by Date */}
      {Object.entries(sessionsByDate)
        .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
        .map(([dateString, sessions]) => (
          <div key={dateString} className="space-y-3">
            
            {/* Date Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
              <Calendar size={20} className="text-gray-500" />
              <h4 className="text-lg font-medium text-gray-900">
                {formatDateHeader(dateString)}
              </h4>
              <span className="text-sm text-gray-500">
                ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Sessions for this date */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onFileSelect={handleFileSelect}
                  icon={getSessionIcon(session.type)}
                  colors={getSessionColors(session.type)}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

export default ScheduleDisplay;