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
 *   launching and progress tracking while providing intuitive navigation and interaction patterns.
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
  CheckCircle 
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
 * Main calendar month view component that renders a traditional calendar grid
 * with daily study sessions and provides navigation, interaction, and session
 * management capabilities for the enhanced calendar system.
 */
const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({ onFileSelect }) => {
  console.log('[CalendarMonthView.tsx][5001] › Rendering calendar month view');

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

  const { requestSessionLaunch } = useSlideShow();

  // Step 2: Initialize local state for UI interactions
  const [tooltip, setTooltip] = useState<SessionTooltipData>({
    session: null as any,
    position: { x: 0, y: 0 },
    visible: false,
  });

  const tooltipRef = useRef<HTMLDivElement>(null);

  /**
   * Handles session click events by launching the session through the provided
   * callback and providing user feedback about the session launch process.
   */
  const handleSessionClick = useCallback((session: StudySession) => {
    console.log('[CalendarMonthView.tsx][5002] › Session clicked:', session.id);
    
    // Hide tooltip when launching session
    setTooltip(prev => ({ ...prev, visible: false }));
    
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
    } 

  }, [createSessionLauncher, onFileSelect, requestSessionLaunch]);

  /**
   * Handles session hover events by displaying detailed tooltip information
   * with proper positioning and comprehensive session metadata display.
   */
  const handleSessionHover = useCallback((
    session: StudySession, 
    event: React.MouseEvent,
    show: boolean
  ) => {
    if (show) {
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
  }, []);

  /**
   * Handles day cell click events for future functionality like adding
   * new sessions or viewing detailed daily schedules.
   */
  const handleDayClick = useCallback((date: Date) => {
    console.log('[CalendarMonthView.tsx][5003] › Day clicked:', date.toDateString());
    // Future: Open day detail view or add session dialog
  }, []);

  /**
   * Formats month and year for header display with proper localization
   * and consistent formatting across different locales and languages.
   */
  const formatMonthYear = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, []);

  /**
   * Generates calendar grid days including previous/next month overflow
   * to create a complete 6-week calendar grid for consistent layout.
   */
  const generateCalendarDays = useCallback(() => {
    if (!currentMonth) return [];

    const year = currentMonth.year;
    const month = currentMonth.month;
    
    // First day of the month and its day of week
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Calculate previous month overflow
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays: Date[] = [];
    
    // Add previous month overflow days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push(new Date(year, month - 1, daysInPrevMonth - i));
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(new Date(year, month, day));
    }
    
    // Add next month overflow to complete 6 weeks (42 days)
    const remainingDays = 42 - calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      calendarDays.push(new Date(year, month + 1, day));
    }
    
    return calendarDays;
  }, [currentMonth]);

  // Step 3: Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading calendar...</span>
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
    <div className="calendar-month-view bg-white rounded-lg shadow-sm border border-gray-200">
      
      {/* Step 4: Calendar Header with Navigation */}
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

      {/* Step 5: Calendar Grid */}
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
              />
            );
          })}
        </div>
      </div>

      {/* Step 6: Session Tooltip */}
      {tooltip.visible && tooltip.session && (
        <SessionTooltip
          ref={tooltipRef}
          session={tooltip.session}
          position={tooltip.position}
        />
      )}
    </div>
  );
};

/**
 * Individual calendar day cell component that displays the date and all
 * scheduled study sessions with proper visual styling and interaction handling.
 */
const CalendarDayCell: React.FC<CalendarDayProps & {
  onSessionHover: (session: StudySession, event: React.MouseEvent, show: boolean) => void;
}> = ({ 
  date, 
  dailyPlan, 
  isCurrentDay, 
  isCurrentMonth, 
  onSessionClick, 
  onSessionHover, 
  onDayClick 
}) => {
  const dayNumber = date.getDate();
  const sessions = dailyPlan?.sessions || [];

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
        {sessions.slice(0, 3).map((session, index) => (
          <SessionChip
            key={session.id}
            session={session}
            onClick={(e) => {
              e.stopPropagation();
              onSessionClick(session);
            }}
            onMouseEnter={(e) => onSessionHover(session, e, true)}
            onMouseLeave={(e) => onSessionHover(session, e, false)}
          />
        ))}
        
        {/* Show overflow indicator */}
        {sessions.length > 3 && (
          <div className="text-xs text-gray-500 text-center py-1">
            +{sessions.length - 3} more
          </div>
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
 * Compact session chip component for display within calendar day cells.
 * Shows session type, subject, and provides visual feedback for interactions.
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
      onClick={onClick}
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
      
      {/* Time slot indicator */}
      {session.timeSlot && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white opacity-75"></div>
      )}
    </div>
  );
};

/**
 * Session tooltip component that displays detailed session information on hover
 * with comprehensive metadata and launch instructions for user guidance.
 */
const SessionTooltip = React.forwardRef<HTMLDivElement, {
  session: StudySession;
  position: { x: number; y: number };
}>(({ session, position }, ref) => {
  
  const getSessionTypeDetails = (type: string) => {
    switch (type) {
      case 'block':
        return {
          title: 'Learning Session',
          description: 'Comprehensive study with concept maps, notes, and practice',
          icon: <BookOpen size={16} className="text-blue-600" />,
        };
      case 'revision-block':
        return {
          title: 'Focused Review',
          description: 'Targeted review with flashcards and quizzes',
          icon: <RotateCcw size={16} className="text-green-600" />,
        };
      case 'revision-interleaved':
        return {
          title: 'Mixed Review',
          description: 'Interleaved practice across multiple topics',
          icon: <Shuffle size={16} className="text-purple-600" />,
        };
      default:
        return {
          title: 'Study Session',
          description: 'General study session',
          icon: <Calendar size={16} className="text-gray-600" />,
        };
    }
  };

  const typeDetails = getSessionTypeDetails(session.type);

  return (
    <div
      ref={ref}
      className="session-tooltip absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm"
      style={{
        left: position.x - 150, // Center tooltip
        top: position.y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      {/* Session Header */}
      <div className="flex items-start space-x-3 mb-3">
        {typeDetails.icon}
        <div>
          <h4 className="font-medium text-gray-900">{typeDetails.title}</h4>
          <p className="text-sm text-gray-600">{session.notebookMeta.fileName}</p>
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
        
        <div>
          <p className="text-gray-600 mb-1">{typeDetails.description}</p>
          <p className="text-gray-800">
            Topics: {session.metadata.topicTitles.join(', ')}
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