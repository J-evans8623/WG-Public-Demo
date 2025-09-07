/**
 * @file CalendarMonthView.tsx
 * @description
 *   30/31 day calendar grid component that displays monthly study schedules with multiple sessions per day,
 *   subject color coding, and interactive session management. This component renders a traditional calendar
 *   layout where each day cell contains compact session cards showing different subjects with visual distinction
 *   through color coding and session type indicators. The implementation supports session tooltips on hover,
 *   click-to-launch functionality, and current day highlighting while maintaining responsive design for
 *   different screen sizes. The calendar view provides comprehensive daily study overview and enables users
 *   to quickly understand their study distribution across the month with clear visual indicators for session
 *   types, subject variety, and completion status. The component integrates with calendar context for session
 *   launching and progress tracking while providing intuitive navigation and interaction patterns. Updated
 *   with enhanced session overflow handling through a popover system that displays all sessions when
 *   users click on the "see more" indicator, providing better access to all scheduled sessions per day.
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  BookOpen, 
  RotateCcw, 
  Shuffle,
  CheckCircle,
  X
} from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { 
  CalendarDayProps, 
  PickerFileMeta, 
  SessionTooltipData, 
  StudySession, 
} from '@/app/Library/Definitions/CalendarDefinitions';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';

interface CalendarMonthViewProps {
  onFileSelect: (meta: PickerFileMeta) => void; 
}

/**
 * Enhanced calendar month view component with Phase 4 dynamic extension support, session launching,
 * and improved session overflow handling through popover system. Provides comprehensive session
 * display and interaction capabilities while maintaining clean calendar layout and accessibility.
 */
const CalendarMonthView: React.FC<CalendarMonthViewProps & {
  onSessionLaunch?: (sessionId: string) => void;
}> = ({ onFileSelect, onSessionLaunch }) => {
  console.log('[CalendarMonthView.tsx][5001] › Rendering calendar month view with enhanced session overflow handling');

  // Step 1: Access calendar context for state and operations
  const {
    currentMonth,
    currentDate,
    navigateMonth,
    getDailyPlan,
    markSessionCompleted,
    markSessionIncomplete,
    isLoading,
    error,
    createSessionLauncher,
  } = useCalendar();

  const extensionInProgress = isLoading;
  const { requestSessionLaunch } = useSlideShow();

  // Step 2: Initialize local state for UI interactions including session popover
  const [tooltip, setTooltip] = useState<SessionTooltipData>({
    session: null as any,
    position: { x: 0, y: 0 },
    visible: false,
  });

  const [sessionPopover, setSessionPopover] = useState<{
    visible: boolean;
    sessions: StudySession[];
    position: { x: number; y: number };
    date: Date;
  }>({
    visible: false,
    sessions: [],
    position: { x: 0, y: 0 },
    date: new Date(),
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  /**
   * Enhanced session click handler with Phase 4 integration for dynamic content handling.
   * Coordinates session launching through parent callback while maintaining compatibility
   * with both direct launching and modal-coordinated launching patterns.
   */
  const handleSessionClick = useCallback((session: StudySession) => {
    console.log('[CalendarMonthView.tsx][5002] › Session clicked with Phase 4 handling:', session.id);
    
    // Step 3: Hide tooltip and popover when launching session
    setTooltip(prev => ({ ...prev, visible: false }));
    setSessionPopover(prev => ({ ...prev, visible: false }));
    
    try {
      if (onSessionLaunch) {
        console.log('[CalendarMonthView.tsx][5090] › Using parent session launch callback');
        onSessionLaunch(session.id);
        return;
      }

      // Step 4: Fallback to direct session launching (standalone usage)
      const pickerMeta = createSessionLauncher(session.id);
      
      if (!pickerMeta) {
        console.error('[CalendarMonthView.tsx][5091] › Failed to create session launcher metadata');
        return;
      }
      
      requestSessionLaunch({
        sessionId: session.id,
        sessionData: session,
        targetFileId: session.notebookMeta.fileId
      });
      
      onFileSelect(pickerMeta);
      
      console.log('[CalendarMonthView.tsx][5092] › Direct session launch completed successfully');
      
    } catch (error) {
      console.error('[CalendarMonthView.tsx][5093] › Error launching session:', error);
    }
  }, [createSessionLauncher, onFileSelect, requestSessionLaunch, onSessionLaunch]);

  /**
   * Handles the "see more" sessions functionality by displaying a popover with all sessions
   * for the selected day. Provides complete session access without cluttering the calendar grid.
   */
  const handleShowMoreSessions = useCallback((
    sessions: StudySession[], 
    date: Date, 
    event: React.MouseEvent
  ) => {
    console.log('[CalendarMonthView.tsx][5003] › Showing session popover for', sessions.length, 'sessions on', date.toDateString());
    
    event.stopPropagation();
    
    // Step 5: Calculate popover position relative to the clicked element
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = event.currentTarget.closest('.calendar-month-view')?.getBoundingClientRect() || { left: 0, top: 0 };
    
    setSessionPopover({
      visible: true,
      sessions: sessions,
      position: {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 10,
      },
      date: new Date(date),
    });
    
    // Step 6: Hide tooltip if visible
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  /**
   * Closes the session popover when user clicks outside or explicitly closes it.
   * Provides clean interaction patterns for session overflow management.
   */
  const handleClosePopover = useCallback(() => {
    console.log('[CalendarMonthView.tsx][5004] › Closing session popover');
    setSessionPopover(prev => ({ ...prev, visible: false }));
  }, []);

  // Step 7: Existing hover and utility methods remain unchanged
  const handleSessionHover = useCallback((
    session: StudySession, 
    event: React.MouseEvent,
    show: boolean
  ) => {
    if (show && !sessionPopover.visible) {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        session,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        },
        visible: true,
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  }, [sessionPopover.visible]);

  const handleDayClick = useCallback((date: Date) => {
    console.log('[CalendarMonthView.tsx][5005] › Day clicked:', date.toDateString());
  }, []);

  const formatMonthYear = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const generateCalendarDays = useCallback(() => {
    if (!currentMonth) return [];

    const year = currentMonth.year;
    const month = currentMonth.month;
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays: Date[] = [];
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push(new Date(year, month - 1, daysInPrevMonth - i));
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(new Date(year, month, day));
    }
    
    const remainingDays = 42 - calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      calendarDays.push(new Date(year, month + 1, day));
    }
    
    return calendarDays;
  }, [currentMonth]);

  // Step 8: Enhanced loading state with extension progress
  if (isLoading || extensionInProgress) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">
          {extensionInProgress ? 'Extending calendar...' : 'Loading calendar...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">
          <Calendar size={48} className="mx-auto mb-2" />
          <p className="text-lg font-medium">Error Loading Calendar</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentMonth) {
    return (
      <div className="text-center py-8">
        <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Calendar Generated
        </h3>
        <p className="text-gray-600 mb-4">
          Select notebooks and generate a schedule to view your calendar.
        </p>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const today = new Date();

  return (
    <div className="calendar-month-view bg-white rounded-lg shadow-sm border border-gray-200 relative">
      
      {/* Step 9: Calendar Header with Navigation */}
      <div className="calendar-header flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Previous Month"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        
        <h2 className="text-xl font-semibold text-gray-900">
          {formatMonthYear(currentDate)}
        </h2>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Next Month"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Step 10: Calendar Grid */}
      <div className="calendar-grid">
        
        {/* Day Headers */}
        <div className="calendar-day-headers grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="calendar-days-grid grid grid-cols-7">
          {calendarDays.map((date, index) => {
            const dailyPlan = getDailyPlan(date);
            const isCurrentDay = date.toDateString() === today.toDateString();
            const isCurrentMonth = date.getMonth() === currentMonth.month;
            
            return (
              <CalendarDayCell
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                date={date}
                dailyPlan={dailyPlan}
                isCurrentDay={isCurrentDay}
                isCurrentMonth={isCurrentMonth}
                onSessionClick={handleSessionClick}
                onSessionHover={handleSessionHover}
                onDayClick={handleDayClick}
                onShowMoreSessions={handleShowMoreSessions}
              />
            );
          })}
        </div>
      </div>

      {/* Step 11: Session Tooltip */}
      {tooltip.visible && tooltip.session && (
        <SessionTooltip
          ref={tooltipRef}
          session={tooltip.session}
          position={tooltip.position}
        />
      )}

      {/* Step 12: Session Popover for overflow sessions */}
      {sessionPopover.visible && (
        <SessionPopover
          ref={popoverRef}
          sessions={sessionPopover.sessions}
          date={sessionPopover.date}
          position={sessionPopover.position}
          onClose={handleClosePopover}
          onSessionClick={handleSessionClick}
        />
      )}
    </div>
  );
};

/**
 * Enhanced individual calendar day cell component with session overflow handling.
 * Displays up to 3 sessions and provides "see more" functionality for additional sessions
 * through popover integration, maintaining clean calendar layout while ensuring full access.
 */
const CalendarDayCell: React.FC<CalendarDayProps & {
  onSessionHover: (session: StudySession, event: React.MouseEvent, show: boolean) => void;
  onShowMoreSessions: (sessions: StudySession[], date: Date, event: React.MouseEvent) => void;
}> = ({ 
  date, 
  dailyPlan, 
  isCurrentDay, 
  isCurrentMonth, 
  onSessionClick, 
  onSessionHover, 
  onDayClick,
  onShowMoreSessions
}) => {
  const dayNumber = date.getDate();
  const sessions = dailyPlan?.sessions || [];
  const visibleSessions = sessions.slice(0, 3);
  const additionalSessionsCount = Math.max(0, sessions.length - 3);

  return (
    <div
      className={`calendar-day-cell min-h-[120px] p-2 border-r border-b border-gray-200 cursor-pointer transition-colors ${
        isCurrentDay 
          ? 'bg-blue-50 border-blue-200' 
          : isCurrentMonth 
            ? 'bg-white hover:bg-gray-50' 
            : 'bg-gray-50 text-gray-400'
      }`}
      onClick={() => onDayClick(date)}
    >
      {/* Day Number */}
      <div className={`text-sm font-medium mb-1 ${
        isCurrentDay 
          ? 'text-blue-600' 
          : isCurrentMonth 
            ? 'text-gray-900' 
            : 'text-gray-400'
      }`}>
        {dayNumber}
      </div>

      {/* Study Sessions */}
      <div className="space-y-1">
        {visibleSessions.map((session, index) => (
          <SessionChip
            key={session.id}
            session={session}
            onClick={(e) => {
              e.stopPropagation();
              console.log('[CalendarDayCell][5094] › SessionChip clicked, delegating to onSessionClick');
              onSessionClick(session);
            }}
            onMouseEnter={(e) => onSessionHover(session, e, true)}
            onMouseLeave={(e) => onSessionHover(session, e, false)}
          />
        ))}
        
        {/* Step 13: Enhanced "See More" button with click handler */}
        {additionalSessionsCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowMoreSessions(sessions, date, e);
            }}
            className="w-full text-xs text-gray-500 hover:text-blue-600 text-center py-1 rounded hover:bg-blue-50 transition-colors"
          >
            +{additionalSessionsCount} more
          </button>
        )}
      </div>

      {/* Daily Summary */}
      {dailyPlan && sessions.length > 0 && (
        <div className="mt-2 pt-1 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{sessions.length} sessions</span>
            <span>{Math.round(dailyPlan.totalDuration / 60)}h</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Enhanced compact session chip component with Phase 4 session launching integration.
 * Maintains visual design while providing enhanced session launch coordination through
 * parent callbacks and proper event handling for both click and hover interactions.
 */
const SessionChip: React.FC<{
  session: StudySession;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}> = ({ session, onClick, onMouseEnter, onMouseLeave }) => {
  
  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'block':
        return <BookOpen size={10} />;
      case 'revision-block':
        return <RotateCcw size={10} />;
      case 'revision-interleaved':
        return <Shuffle size={10} />;
      default:
        return <Calendar size={10} />;
    }
  };

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case 'block':
        return 'Learn';
      case 'revision-block':
        return 'Review';
      case 'revision-interleaved':
        return 'Mixed';
      default:
        return 'Study';
    }
  };

  const backgroundColor = session.notebookMeta.color || '#6B7280';

  return (
    <div
      className="session-chip relative group cursor-pointer rounded px-2 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
      style={{ backgroundColor }}
      onClick={(e) => {
        console.log('[SessionChip][5095] › SessionChip direct click handler, session:', session.id);
        onClick(e);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center space-x-1">
        {getSessionIcon(session.type)}
        <span className="truncate">{getSessionTypeLabel(session.type)}</span>
        <span className="text-xs opacity-75">
          {session.metadata.estimatedDuration}m
        </span>
      </div>
      
      {session.timeSlot && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white opacity-75"></div>
      )}
    </div>
  );
};

/**
 * Session popover component that displays all sessions for a specific day when overflow occurs.
 * Provides comprehensive session access through an overlay that maintains calendar context while
 * allowing users to view and interact with all scheduled sessions without cluttering the grid.
 */
const SessionPopover = React.forwardRef<HTMLDivElement, {
  sessions: StudySession[];
  date: Date;
  position: { x: number; y: number };
  onClose: () => void;
  onSessionClick: (session: StudySession) => void;
}>(({ sessions, date, position, onClose, onSessionClick }, ref) => {
  
  // Step 14: Click outside handler for popover
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref && typeof ref === 'object' && ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, onClose]);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalDuration = sessions.reduce((sum, session) => sum + session.metadata.estimatedDuration, 0);

  return (
    <div
      ref={ref}
      className="session-popover absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-sm w-80"
      style={{
        left: Math.max(10, position.x - 160), // Center and ensure it stays within bounds
        top: position.y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      {/* Step 15: Popover Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h4 className="font-medium text-gray-900">{formatDate(date)}</h4>
          <p className="text-sm text-gray-600">
            {sessions.length} sessions • {Math.round(totalDuration / 60)}h {totalDuration % 60}m
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close sessions popover"
        >
          <X size={16} />
        </button>
      </div>

      {/* Step 16: Sessions List */}
      <div className="max-h-64 overflow-y-auto">
        <div className="p-2 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                console.log('[SessionPopover][5096] › Session clicked in popover:', session.id);
                onSessionClick(session);
              }}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <div className="flex items-start space-x-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: session.notebookMeta.color || '#6B7280' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-sm text-gray-900 truncate">
                      {session.notebookMeta.fileName}
                    </h5>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {session.metadata.estimatedDuration}m
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">
                    {session.type === 'block' ? 'Learning Session' : 
                     session.type === 'revision-block' ? 'Focused Review' : 'Mixed Review'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {session.metadata.topicTitles.join(', ')}
                  </p>
                  {session.timeSlot && (
                    <div className="mt-1">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded capitalize">
                        {session.timeSlot}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 17: Popover Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500 text-center">
          Click any session to start studying
        </p>
      </div>

      {/* Popover Arrow */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
      </div>
    </div>
  );
});

SessionPopover.displayName = 'SessionPopover';

/**
 * Session tooltip component that displays detailed session information on hover
 * with improved visual hierarchy focusing on notebook title, lesson title, and lesson units.
 * Removes generic descriptions in favor of specific lesson content information.
 */
const SessionTooltip = React.forwardRef<HTMLDivElement, {
  session: StudySession;
  position: { x: number; y: number };
}>(({ session, position }, ref) => {
  
  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'block':
        return <BookOpen size={16} className="text-blue-600" />;
      case 'revision-block':
        return <RotateCcw size={16} className="text-green-600" />;
      case 'revision-interleaved':
        return <Shuffle size={16} className="text-purple-600" />;
      default:
        return <Calendar size={16} className="text-gray-600" />;
    }
  };

  const sessionIcon = getSessionTypeIcon(session.type);

  return (
    <div
      ref={ref}
      className="session-tooltip absolute z-40 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm"
      style={{
        left: position.x - 150,
        top: position.y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      {/* Session Header with improved hierarchy */}
      <div className="flex items-start space-x-3 mb-3">
        {sessionIcon}
        <div className="flex-1 min-w-0">
          {/* Notebook Title */}
          <h4 className="font-medium text-gray-900 text-base truncate">
            {session.notebookMeta.fileName}
          </h4>
          {/* Lesson Title */}
          <p className="text-sm font-medium text-gray-700 mt-1 truncate">
            {session.metadata.sessionTitle}
          </p>
        </div>
      </div>

      {/* Session Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2">
          <Clock size={12} className="text-gray-400" />
          <span>{session.metadata.estimatedDuration} minutes</span>
          {session.timeSlot && (
            <span className="text-gray-500">• {session.timeSlot}</span>
          )}
        </div>
        
        {/* Lesson Units List */}
        <div>
          <p className="text-gray-600 text-xs font-medium mb-1">Topics:</p>
          <p className="text-gray-800">
            {session.metadata.topicTitles.join(', ')}
          </p>
        </div>
      </div>

      {/* Action Hint */}
      <div className="mt-3 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-500">Click to start session</p>
      </div>

      {/* Tooltip Arrow */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
      </div>
    </div>
  );
});

SessionTooltip.displayName = 'SessionTooltip';

export default CalendarMonthView;