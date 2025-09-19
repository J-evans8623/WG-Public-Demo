// CalendarMonthView.tsx

/**
 * @file CalendarMonthView.tsx
 * @description
 *   30/31 day calendar grid component that displays monthly study schedules with multiple sessions per day,
 *   subject color coding, and interactive session management. This component renders a traditional calendar
 *   layout where each day cell contains compact session cards showing different subjects with visual distinction
 *   through color coding and session type indicators. The implementation supports session tooltips on hover,
 *   click-to-launch functionality, and current day highlighting while maintaining responsive design for
 *   different screen sizes.
 *
 *   UPDATE (Portal + Hover UX Fixes):
 *   This version introduces a robust, viewport-relative positioning strategy for hover tooltips and overflow
 *   popovers using React Portals mounted at document.body. By switching to `position: fixed` and using
 *   `clientX/clientY` coordinates from mouse events, tooltips/popovers are no longer constrained by nested
 *   layout containers, eliminating the bug where overlays appeared near the top of the calendar rather than
 *   near the hovered element. In addition, we add “hover intent” logic with short show/hide delays to prevent
 *   flicker and accidental dismissal when the pointer glides across the tooltip zone. The tooltip is rendered
 *   with `pointer-events: none` so it never steals hover from the session chip; the session popover remains
 *   fully interactive (`pointer-events: auto`) to allow clicks. We keep the rest of the calendar’s behavior
 *   unchanged and preserve brand styling classes while injecting only the minimal structural changes necessary
 *   for reliable overlay positioning and smooth UX across all month grid interactions.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  BookOpen,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import {
  CalendarDayProps,
  PickerFileMeta,
  SessionTooltipData,
  StudySession,
} from '@/app/Library/Definitions/CalendarDefinitions';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import './calendar-theme.css';

interface CalendarMonthViewProps {
  onFileSelect: (meta: PickerFileMeta) => void;
}

/**
 * Enhanced calendar month view component with compact grid layout, brand theme integration,
 * and subject-specific session labeling. Provides comprehensive session display and interaction
 * capabilities while maintaining clean calendar layout and accessibility standards.
 *
 * Portal/UX note: This root component now owns hover-intent timers and forwards viewport
 * coordinates to tooltip/popover portals for smooth, stable rendering anchored to the cursor.
 */
const CalendarMonthView: React.FC<
  CalendarMonthViewProps & { onSessionLaunch?: (sessionId: string) => void }
> = ({ onFileSelect, onSessionLaunch }) => {
  console.log('[CalendarMonthView.tsx][2001] › Render CalendarMonthView');

  // 1) Context + services
  const {
    currentMonth,
    currentDate,
    navigateMonth,
    getDailyPlan,
    isLoading,
    error,
    createSessionLauncher,
  } = useCalendar();
  const { requestSessionLaunch } = useSlideShow();

  // 2) Local UI state (tooltip + popover)
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

  // 3) Hover intent timers (guard flicker)
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  /**
   * @function handleSessionClick
   * @description
   *   Launches a session via parent callback (if provided) or directly via SlideShow context.
   *   It also clears any active tooltip/popover to minimize UI clutter when navigating away.
   *   Ensures PickerFileMeta is prepared and handed to onFileSelect for file switching.
   */
  const handleSessionClick = useCallback(
    (session: StudySession) => {
      console.log('[CalendarMonthView.tsx][2002] › Session clicked:', session.id);
      setTooltip((prev) => ({ ...prev, visible: false }));
      setSessionPopover((prev) => ({ ...prev, visible: false }));

      try {
        if (onSessionLaunch) {
          console.log('[CalendarMonthView.tsx][2003] › Delegate launch to parent');
          onSessionLaunch(session.id);
          return;
        }

        const pickerMeta = createSessionLauncher(session.id);
        if (!pickerMeta) {
          console.error('[CalendarMonthView.tsx][2004] › createSessionLauncher failed');
          return;
        }

        requestSessionLaunch({
          sessionId: session.id,
          sessionData: session,
          targetFileId: session.notebookMeta.fileId,
        });

        onFileSelect(pickerMeta);
        console.log('[CalendarMonthView.tsx][2005] › Launch flow complete');
      } catch (e) {
        console.error('[CalendarMonthView.tsx][2006] › Launch error:', e);
      }
    },
    [createSessionLauncher, onFileSelect, onSessionLaunch, requestSessionLaunch]
  );

  /**
   * @function handleShowMoreSessions
   * @description
   *   Displays an interactive popover listing all sessions for a day. Position is computed
   *   in viewport coordinates using the pointer location to ensure the popover appears where
   *   users expect, regardless of scroll containers or nested layout contexts.
   */
  const handleShowMoreSessions = useCallback(
    (sessions: StudySession[], date: Date, event: React.MouseEvent) => {
      console.log(
        '[CalendarMonthView.tsx][2007] › Show popover for',
        sessions.length,
        'sessions'
      );
      event.stopPropagation();

      // Viewport-relative coordinates for position: fixed
      const { clientX, clientY } = event;
      setSessionPopover({
        visible: true,
        sessions,
        position: { x: clientX, y: clientY },
        date: new Date(date),
      });

      // Hide tooltip if present to avoid overlap/conflict
      setTooltip((prev) => ({ ...prev, visible: false }));
    },
    []
  );

  /**
   * @function handleClosePopover
   * @description
   *   Closes the interactive session popover. This is used by the popover itself
   *   (click outside/close button) and by the parent when launching sessions.
   */
  const handleClosePopover = useCallback(() => {
    console.log('[CalendarMonthView.tsx][2008] › Close popover');
    setSessionPopover((prev) => ({ ...prev, visible: false }));
  }, []);

  /**
   * @function handleSessionHover
   * @description
   *   Shows or hides the hover tooltip with a small intent delay to prevent flicker.
   *   Uses viewport-relative pointer coordinates (clientX/clientY) and renders via portal
   *   with position: fixed; tooltip uses pointer-events: none so it never interrupts hover.
   *
   *   Steps:
   *   1) Clear opposing timer (show vs hide) to avoid race conditions.
   *   2) On show: wait ~100ms then show tooltip at event coordinates.
   *   3) On hide: wait ~200ms to allow small pointer movements without flicker.
   */
  const handleSessionHover = useCallback(
    (session: StudySession, event: React.MouseEvent, show: boolean) => {
      // Step 1: Cancel any existing timers of the opposite type
      if (show && hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (!show && showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      if (show) {
        // Step 2: Schedule a small delay to confirm hover intent
        const { clientX, clientY } = event;
        showTimerRef.current = window.setTimeout(() => {
          setTooltip({
            session,
            position: { x: clientX, y: clientY },
            visible: true,
          });
          // Hide popover if it was open to avoid stacking overlays
          setSessionPopover((prev) => ({ ...prev, visible: false }));
          console.log('[CalendarMonthView.tsx][2010] › Tooltip show @', clientX, clientY);
        }, 100);
      } else {
        // Step 3: Graceful hide to prevent flicker when pointer crosses tooltip area
        hideTimerRef.current = window.setTimeout(() => {
          setTooltip((prev) => ({ ...prev, visible: false }));
          console.log('[CalendarMonthView.tsx][2011] › Tooltip hide (delay)');
        }, 200);
      }
    },
    []
  );

  /**
   * @function handleDayClick
   * @description
   *   Day click handler reserved for future interactions (e.g., quick add). Kept to preserve
   *   existing click affordance in the day cell area without changing behavior now.
   */
  const handleDayClick = useCallback((date: Date) => {
    console.log('[CalendarMonthView.tsx][2009] › Day clicked:', date.toDateString());
  }, []);

  const formatMonthYear = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  /**
   * @function generateCalendarDays
   * @description
   *   Produces a fixed 6x7 grid (42 cells) including leading/trailing days. This logic is
   *   unchanged and is not related to the UX fixes for tooltip/popover.
   */
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

  // Loading & error states (unchanged)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 calendar-container">
        <div className="calendar-loading-spinner" />
        <span className="ml-3 calendar-text-secondary">Loading calendar...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-8 calendar-container">
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
      <div className="text-center py-8 calendar-container">
        <Calendar size={48} className="mx-auto calendar-text-muted mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Calendar Generated</h3>
        <p className="calendar-text-secondary mb-4">
          Select notebooks and generate a schedule to view your calendar.
        </p>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const today = new Date();

  return (
    <div className="calendar-month-view calendar-container relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => navigateMonth('prev')}
          className="calendar-btn-icon"
          title="Previous Month"
        >
          <ChevronLeft size={20} />
        </button>

        <h2 className="text-xl font-semibold text-gray-900">
          {formatMonthYear(currentDate)}
        </h2>

        <button
          onClick={() => navigateMonth('next')}
          className="calendar-btn-icon"
          title="Next Month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid */}
      <div className="calendar-month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {calendarDays.map((date) => {
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

      {/* Tooltip (Portal, fixed, non-interactive) */}
      {tooltip.visible && tooltip.session && (
        <SessionTooltipPortal
          session={tooltip.session}
          position={tooltip.position}
        />
      )}

      {/* Popover (Portal, fixed, interactive) */}
      {sessionPopover.visible && (
        <SessionPopoverPortal
          sessions={sessionPopover.sessions}
          date={sessionPopover.date}
          position={sessionPopover.position}
          onClose={handleClosePopover}
          onSessionClick={(s) => handleSessionClick(s)}
        />
      )}
    </div>
  );
};

/**
 * @function CalendarDayCell
 * @description
 *   Renders one day cell with up to three visible sessions and a “+N more” control for overflow.
 *   It wires session hover handlers (with intent logic managed by the parent) and delegate clicks
 *   upwards for launching. Styling and structure remain consistent with the brand calendar theme.
 */
const CalendarDayCell: React.FC<
  CalendarDayProps & {
    onSessionHover: (session: StudySession, event: React.MouseEvent, show: boolean) => void;
    onShowMoreSessions: (
      sessions: StudySession[],
      date: Date,
      event: React.MouseEvent
    ) => void;
  }
> = ({
  date,
  dailyPlan,
  isCurrentDay,
  isCurrentMonth,
  onSessionClick,
  onSessionHover,
  onDayClick,
  onShowMoreSessions,
}) => {
  const dayNumber = date.getDate();
  const sessions = dailyPlan?.sessions || [];
  const visibleSessions = sessions.slice(0, 3);
  const additionalSessionsCount = Math.max(0, sessions.length - 3);

  return (
    <div
      className={`calendar-day-cell ${isCurrentDay ? 'current-day' : ''} ${
        !isCurrentMonth ? 'other-month' : ''
      }`}
      onClick={() => onDayClick(date)}
    >
      <div className="calendar-day-number">{dayNumber}</div>

      <div className="calendar-session-container">
        {visibleSessions.map((session) => (
          <SessionChip
            key={session.id}
            session={session}
            onClick={(e) => {
              e.stopPropagation();
              console.log('[CalendarDayCell][2017] › Chip click → launch');
              onSessionClick(session);
            }}
            onMouseEnter={(e) => {
              console.log('[CalendarDayCell][2018] › Hover enter → schedule tooltip');
              onSessionHover(session, e, true);
            }}
            onMouseLeave={(e) => {
              console.log('[CalendarDayCell][2019] › Hover leave → schedule hide');
              onSessionHover(session, e, false);
            }}
          />
        ))}

        {additionalSessionsCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowMoreSessions(sessions, date, e);
            }}
            className="w-full text-xs calendar-text-secondary hover:text-blue-600 text-center py-1 rounded hover:bg-blue-50 transition-colors"
          >
            +{additionalSessionsCount} more
          </button>
        )}
      </div>

      {dailyPlan && sessions.length > 0 && (
        <div className="mt-2 pt-1 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs calendar-text-secondary">
            <span>{sessions.length} sessions</span>
            <span>{Math.round(dailyPlan.totalDuration / 60)}h</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * @function SessionChip
 * @description
 *   Compact, color-coded chip for a single study session. The entire chip surface is interactive,
 *   and hover events are forwarded to the parent to drive tooltip display via intent logic.
 *   Uses the notebook color for fast subject recognition.
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
        return '📖';
      case 'revision-block':
        return '📝';
      case 'revision-interleaved':
        return '🔄';
      default:
        return '📖';
    }
  };

  const getSubjectName = (notebookName: string) =>
    notebookName.replace(/\.(pdf|docx?|txt)$/i, '').replace(/^(notebook|notes?|study)\s*/i, '').trim();

  const subjectName = getSubjectName(session.notebookMeta.fileName);
  const sessionIcon = getSessionIcon(session.type);
  const backgroundColor = session.notebookMeta.color || '#6B7280';

  console.log('[SessionChip][2013] › Color for', subjectName, ':', backgroundColor);

  return (
    <div
      className="calendar-session-label"
      style={{ backgroundColor }}
      onClick={(e) => {
        console.log('[SessionChip][2014] › Chip click → session:', session.id);
        onClick(e);
      }}
      onMouseEnter={(e) => {
        // Important: pass through client coordinates; parent adds intent delay
        onMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeave(e);
      }}
    >
      <span className="calendar-session-icon">{sessionIcon}</span>
      <span className="calendar-session-subject">{subjectName}</span>
    </div>
  );
};

/**
 * @function SessionPopoverPortal
 * @description
 *   Interactive popover rendered into document.body via portal. Uses `position: fixed` with
 *   viewport-relative coordinates for accurate placement near the trigger. Supports outside
 *   click to close and remains fully interactive (`pointer-events: auto`).
 */
const SessionPopoverPortal: React.FC<{
  sessions: StudySession[];
  date: Date;
  position: { x: number; y: number };
  onClose: () => void;
  onSessionClick: (session: StudySession) => void;
}> = ({ sessions, date, position, onClose, onSessionClick }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    const handle = (evt: MouseEvent) => {
      if (ref.current && !ref.current.contains(evt.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const totalDuration = sessions.reduce(
    (sum, s) => sum + (s.metadata?.estimatedDuration ?? 0),
    0
  );

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - 10,
    transform: 'translate(-50%, -100%)',
    zIndex: 9999,
    pointerEvents: 'auto',
  };

  const content = (
    <div ref={ref} style={style}>
      <div className="session-popover calendar-bg-secondary border border-gray-200 rounded-lg shadow-lg max-w-sm w-80">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h4 className="font-medium text-gray-900">{formatDate(date)}</h4>
            <p className="text-sm calendar-text-secondary">
              {sessions.length} sessions • {Math.round(totalDuration / 60)}h {totalDuration % 60}m
            </p>
          </div>
          <button onClick={onClose} className="calendar-btn-icon" aria-label="Close sessions popover">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto">
          <div className="p-2 space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  console.log('[SessionPopover][2012] › Session clicked in popover:', session.id);
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
                      <span className="text-xs calendar-text-secondary flex-shrink-0 ml-2">
                        {session.metadata.estimatedDuration}m
                      </span>
                    </div>
                    <p className="text-xs calendar-text-secondary mb-1">
                      {session.type === 'block'
                        ? 'Learning Session'
                        : session.type === 'revision-block'
                        ? 'Focused Review'
                        : 'Mixed Review'}
                    </p>
                    <p className="text-xs calendar-text-muted truncate">
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

        <div className="p-3 border-t border-gray-200 calendar-bg-primary rounded-b-lg">
          <p className="text-xs calendar-text-secondary text-center">Click any session to start studying</p>
        </div>

        {/* Arrow */}
        <div className="relative h-0">
          <div className="absolute left-1/2 -translate-x-1/2 translate-y-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

/**
 * @function SessionTooltipPortal
 * @description
 *   Non-interactive session tooltip rendered into document.body via portal. Uses `position: fixed`
 *   and pointer-events: none so it never intercepts mouse movement, eliminating hover conflicts
 *   that previously caused flicker or immediate hides when crossing the tooltip.
 */
const SessionTooltipPortal: React.FC<{
  session: StudySession;
  position: { x: number; y: number };
}> = ({ session, position }) => {
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

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - 10,
    transform: 'translate(-50%, -100%)',
    zIndex: 9998,
    pointerEvents: 'none', // CRITICAL: avoids stealing hover from chip
  };

  const content = (
    <div style={style}>
      <div className="session-tooltip calendar-bg-secondary border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start space-x-3 mb-3">
          {getSessionTypeIcon(session.type)}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-base truncate">
              {session.notebookMeta.fileName}
            </h4>
            <p className="text-sm font-medium text-gray-700 mt-1 truncate">
              {session.metadata.sessionTitle}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <Clock size={12} className="calendar-text-muted" />
            <span>{session.metadata.estimatedDuration} minutes</span>
            {session.timeSlot && <span className="calendar-text-secondary">• {session.timeSlot}</span>}
          </div>
          <div>
            <p className="calendar-text-secondary text-xs font-medium mb-1">Topics:</p>
            <p className="text-gray-800">{session.metadata.topicTitles.join(', ')}</p>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-200">
          <p className="text-xs calendar-text-secondary">Click to start session</p>
        </div>

        {/* Arrow */}
        <div className="relative h-0">
          <div className="absolute left-1/2 -translate-x-1/2 translate-y-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CalendarMonthView;
