// CalendarMonthView.tsx
/***************************************************************************************************
 * @file CalendarMonthView.tsx
 * @description
 *   This component renders the user’s study schedule inside the Study Planner modal. It is
 *   responsible for presenting the current month’s plan, supporting month navigation, and
 *   providing interactive session affordances (launch session, hover tooltips, and a context
 *   menu for completion toggles). The file now supports two presentation modes:
 *
 *   (1) Desktop / large screens:
 *       - A standard 7x6 monthly grid with expandable day cells.
 *       - Hover-intent tooltips for sessions and a right-click context menu for completion.
 *
 *   (2) Mobile / small screens:
 *       - A clean agenda-style list (Prompt A) that reduces visual clutter and matches the
 *         approved mobile mock. It shows a sticky month header with chevrons, then a vertical
 *         list of day cards where the left column displays weekday + day number and the right
 *         column stacks session chips. Days with no sessions render a calm empty-state row.
 *
 *   The mobile mode is intentionally “render-only” (no hover expectations) while preserving
 *   desktop interactions exactly as-is. This keeps UX consistent across devices without
 *   refactoring upstream calendar data structures or CSS foundations.
 ***************************************************************************************************/


import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  RotateCcw,
  Shuffle,
  Info
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';
import {
  CalendarDayProps,
  PickerFileMeta,
  SessionTooltipData,
  StudySession,
} from '@/app/Library/Definitions/CalendarDefinitions';
import '../calendar-theme.css'; 
import SessionContextMenuPortal from '../SessionContextMenuPortal';

interface CalendarMonthViewProps {
  onFileSelect: (meta: PickerFileMeta) => void;
  onSessionLaunch: (sessionId: string) => void;
}



/**
 * @function useIsMobile
 * @description
 *   A small, production-safe viewport hook that returns true when the window width is at or
 *   below the provided breakpoint. This is used to switch the calendar rendering from a
 *   desktop monthly grid to a mobile agenda list without changing upstream data contracts.
 *   The hook listens for media query changes and cleans up its listeners to avoid leaks.
 */
function useIsMobile(breakpointPx: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);

    const apply = () => setIsMobile(!!mq.matches);
    apply();

    // Support both modern + legacy listener APIs
    const onChange = () => apply();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else mq.addListener(onChange);

    return () => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}


const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({ 
  onFileSelect, 
  onSessionLaunch 
}) => {
  const {
    currentMonth,
    currentDate,
    navigateMonth,
    isLoading,
    error,
    markSessionCompleted,
    markSessionIncomplete,
    completedSessions,
  } = useCalendar();


  const isMobile = useIsMobile(768);

  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const HOVER_INTENT_DELAY = 500; // Time (ms) mouse must stay still to show tooltip
const HIDE_DELAY = 300;         // Time (ms) before tooltip disappears on leave

  const [tooltip, setTooltip] = useState<SessionTooltipData>({
    session: null as any,
    position: { x: 0, y: 0 },
    visible: false,
  });

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    session: StudySession | null;
    position: { x: number; y: number };
  }>({ visible: false, session: null, position: { x: 0, y: 0 } });

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const completedSet = useMemo(() => new Set(completedSessions), [completedSessions]);

  const dailyPlansMap = useMemo(() => {
    if (!currentMonth?.dailyPlans) return new Map();
    const map = new Map();
    currentMonth.dailyPlans.forEach((plan) => {
      const key = `${plan.date.getFullYear()}-${plan.date.getMonth()}-${plan.date.getDate()}`;
      map.set(key, plan);
    });
    return map;
  }, [currentMonth?.dailyPlans]);

  const getDateKey = useCallback((date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }, []);

  const getDailyPlanFromMap = useCallback((date: Date) => {
    return dailyPlansMap.get(getDateKey(date)) || null;
  }, [dailyPlansMap, getDateKey]);

  const toggleExpansion = useCallback((date: Date) => {
    const key = getDateKey(date);
    setExpandedDayKey((prev) => (prev === key ? null : key));
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, [getDateKey]);

  const handleNavigation = (direction: 'prev' | 'next') => {
    navigateMonth(direction);
  };

  const formatHeaderTitle = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const generateGrid = useCallback(() => {
    if (!currentMonth) return [];

    const mk = (y: number, m: number, d: number) => {
      const dt = new Date(y, m, d);
      dt.setHours(0, 0, 0, 0);
      return dt;
    };

    const year = currentMonth.year;
    const month = currentMonth.month;
    const firstDay = mk(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDay = mk(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = mk(year, month, 0).getDate();

    const calendarDays: Date[] = [];
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push(mk(year, month - 1, daysInPrevMonth - i));
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(mk(year, month, day));
    }
    
    const remaining = 42 - calendarDays.length;
    for (let day = 1; day <= remaining; day++) {
      calendarDays.push(mk(year, month + 1, day));
    }
    return calendarDays;
  }, [currentMonth]);



  
   /**
   * @function buildAgendaDaysForMonth
   * @description
   *   Creates a stable list of every day in the currently-viewed month so the mobile agenda
   *   can render both scheduled and unscheduled days. This is important to match the approved
   *   mock where empty days still appear as cards with “No sessions scheduled,” preventing
   *   confusing gaps and preserving a planner-like rhythm for scanning.
   */
  const buildAgendaDaysForMonth = useCallback((): Date[] => {

    if (!currentMonth) return [];

    const year = currentMonth.year;
    const month = currentMonth.month;
    const last = new Date(year, month + 1, 0).getDate();
    const days: Date[] = [];
    for (let d = 1; d <= last; d++) {
      const dt = new Date(year, month, d);
      dt.setHours(0, 0, 0, 0);
      days.push(dt);
    }
    return days;
  }, [currentMonth]);


const handleSessionHover = useCallback((session: StudySession, event: React.MouseEvent, isEntering: boolean) => {
    if (isEntering) {
        // 1. User entered a chip. 
        // First, kill any pending "hide" timer so the tooltip doesn't flicker out if they just moved pixels.
        if (hideTimerRef.current) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }

        // 2. Kill any pending "show" timer from a DIFFERENT chip they might have just passed over.
        if (showTimerRef.current) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }

        // 3. Capture coordinates immediately
        const { clientX, clientY } = event;

        // 4. Start the "Intent" timer. 
        // The tooltip will ONLY show if this timer completes without being cleared by a mouseLeave.
        showTimerRef.current = window.setTimeout(() => {
            setTooltip({ 
                session, 
                position: { x: clientX, y: clientY }, 
                visible: true 
            });
        }, HOVER_INTENT_DELAY); 

    } else {
        // 5. User Left the chip.
        
        // CRITICAL: If the user leaves BEFORE the delay is up (e.g. they only hovered for 100ms),
        // we clear the show timer. This effectively cancels the tooltip request.
        if (showTimerRef.current) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }

        // 6. If the tooltip WAS already visible, schedule a graceful exit
        hideTimerRef.current = window.setTimeout(() => {
            setTooltip((prev) => ({ ...prev, visible: false }));
        }, HIDE_DELAY);
    }
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    hideTimerRef.current = window.setTimeout(() => {
        setTooltip((prev) => ({ ...prev, visible: false }));
    }, 300);
  }, []);

  const openContextMenu = useCallback((session: StudySession, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltip((prev) => ({ ...prev, visible: false }));
    setContextMenu({ visible: true, session, position: { x: e.clientX, y: e.clientY } });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, session: null, position: { x: 0, y: 0 } });
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!currentMonth) return <EmptyState />;

  const gridDays = generateGrid();
  const today = new Date();


  // Mobile agenda path (Prompt A)
  // Find the "Mobile agenda path" inside CalendarMonthView.tsx and replace with this:

  if (isMobile) {
    const agendaDays = buildAgendaDaysForMonth();

    return (
      <div className="calendar-mobile-agenda">
        {/* Fixed Header with Opaque Background */}
        <div className="calendar-mobile-header">
          <div className="flex items-center justify-between w-full max-w-md mx-auto">
            <button
              onClick={() => handleNavigation('prev')}
              className="calendar-btn-icon"
              aria-label="Previous Month"
            >
              <ChevronLeft size={20} />
            </button>

            <h2 className="calendar-mobile-month-title">
              {formatHeaderTitle(currentDate)}
            </h2>

            <button
              onClick={() => handleNavigation('next')}
              className="calendar-btn-icon"
              aria-label="Next Month"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Agenda day cards with standardized spacing */}
        <div className="calendar-mobile-list">
          {agendaDays.map((date) => {
            const dailyPlan = getDailyPlanFromMap(date);
            const sessions: StudySession[] = dailyPlan?.sessions || [];
            const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const isCurrentDay = date.toDateString() === today.toDateString();

            return (
              <div
                key={getDateKey(date)}
                className={`calendar-mobile-card ${isCurrentDay ? 'current-day' : ''}`}
              >
                {/* Standardized Date Column */}
                <div className="calendar-mobile-date-col">
                  <span className="weekday">{weekday}</span>
                  <span className="day-number">{dayNum}</span>
                </div>

                {/* Standardized Sessions Column */}
                <div className="calendar-mobile-sessions-col">
                  {sessions.length === 0 ? (
                    <div className="no-sessions">No sessions scheduled</div>
                  ) : (
                    <div className="session-chip-stack">
                      {sessions.slice(0, 3).map((session) => (
                        <SessionChip
                          key={session.id}
                          session={session}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSessionLaunch(session.id);
                          }}
                          onMouseEnter={() => {}}
                          onMouseLeave={() => {}}
                          onContextMenu={(e) => openContextMenu(session, e)}
                          completed={completedSet.has(session.id)}
                        />
                      ))}
                      {sessions.length > 3 && (
                        <div className="more-sessions-hint">
                          + {sessions.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-month-view calendar-container relative">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="w-[120px]"></div>
        <div className="flex items-center gap-4">
          <button onClick={() => handleNavigation('prev')} className="calendar-btn-icon" title="Previous Month">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center select-none">
            {formatHeaderTitle(currentDate)}
          </h2>
          <button onClick={() => handleNavigation('next')} className="calendar-btn-icon" title="Next Month">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="w-[120px]"></div>
      </div>

      <div className="calendar-labels-row">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-month-grid">
        {gridDays.map((date) => {
          const dateKey = getDateKey(date);
          const dailyPlan = getDailyPlanFromMap(date);
          const isCurrentDay = date.toDateString() === today.toDateString();
          const isCurrentMonth = date.getMonth() === currentMonth.month;
          const isExpanded = expandedDayKey === dateKey;

          return (
            <CalendarDayCell
              key={dateKey}
              date={date}
              dailyPlan={dailyPlan}
              isCurrentDay={isCurrentDay}
              isCurrentMonth={isCurrentMonth}
              isExpanded={isExpanded}
              onSessionClick={(s) => {
                setTooltip(prev => ({ ...prev, visible: false }));
                onSessionLaunch(s.id);
              }}
              onSessionHover={handleSessionHover}
              onToggleExpansion={toggleExpansion}
              onSessionContextMenu={openContextMenu}
              isCompleted={(id) => completedSet.has(id)}
            />
          );
        })}
      </div>

      {/* 4. PORTALS */}
      {tooltip.visible && tooltip.session && (
        <SessionTooltipPortal 
            session={tooltip.session} 
            position={tooltip.position} 
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
        />
      )}

      {contextMenu.visible && contextMenu.session && (
        <SessionContextMenuPortal
          position={contextMenu.position}
          checked={completedSet.has(contextMenu.session.id)}
          onToggle={() => {
            const id = contextMenu.session!.id;
            if (completedSet.has(id)) markSessionIncomplete(id);
            else markSessionCompleted(id);
          }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

const CalendarDayCell: React.FC<
  CalendarDayProps & {
    isExpanded: boolean;
    onSessionHover: (session: StudySession, event: React.MouseEvent, show: boolean) => void;
    onToggleExpansion: (date: Date) => void;
    onSessionContextMenu: (session: StudySession, e: React.MouseEvent) => void;
    isCompleted: (id: string) => boolean;
  }
> = ({
  date,
  dailyPlan,
  isCurrentDay,
  isCurrentMonth,
  isExpanded,
  onSessionClick,
  onSessionHover,
  onToggleExpansion,
  onSessionContextMenu,
  isCompleted,
}) => {
  const dayNumber = date.getDate();
  const sessions = dailyPlan?.sessions || [];
  
  const maxVisible = 3; 
  const visibleSessions = isExpanded ? sessions : sessions.slice(0, maxVisible);
  const hiddenCount = Math.max(0, sessions.length - maxVisible);
  const hasOverflow = sessions.length > maxVisible;

  return (
    <div
      className={`calendar-day-cell ${isCurrentDay ? 'current-day' : ''} ${
        !isCurrentMonth ? 'other-month' : ''
      } ${isExpanded ? 'expanded' : ''}`}
      onClick={(e) => {
          if (hasOverflow && !isExpanded) {
             // Optional click to expand
          }
      }}
    >
      <span className="calendar-day-number">{dayNumber}</span>

      <div className="calendar-session-container">
        {visibleSessions.map((session) => (
          <SessionChip
            key={session.id}
            session={session}
            onClick={(e) => {
              e.stopPropagation();
              onSessionClick(session);
            }}
            onMouseEnter={(e) => onSessionHover(session, e, true)}
            onMouseLeave={(e) => onSessionHover(session, e, false)}
            onContextMenu={(e) => onSessionContextMenu(session, e)}
            completed={isCompleted(session.id)}
          />
        ))}
      </div>
      
      {hasOverflow && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpansion(date);
          }}
          className="calendar-expand-btn"
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <ChevronUp size={12} />
            </>
          ) : (
            <>
              <span>+{hiddenCount} more</span>
              <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
    </div>
  );
};

const SessionChip: React.FC<{
  session: StudySession;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  completed?: boolean;
}> = ({ session, onClick, onMouseEnter, onMouseLeave, onContextMenu, completed }) => {
  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'block': return '📖';
      case 'revision-block': return '📝';
      case 'revision-interleaved': return '🔄';
      default: return '📖';
    }
  };

  const getSubjectName = (notebookName: string) =>
    notebookName.replace(/\.(pdf|docx?|txt)$/i, '').replace(/^(notebook|notes?|study)\s*/i, '').trim();

  const subjectName = getSubjectName(session.notebookMeta.fileName);
  const sessionIcon = getSessionIcon(session.type);
  const backgroundColor = session.notebookMeta.colorCode;
  
  return (
    <div
      className={`calendar-session-label ${completed ? 'calendar-session-completed' : ''}`}
      style={{ backgroundColor }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      <span className="calendar-session-icon">{sessionIcon}</span>
      <span className="calendar-session-subject">{subjectName}</span>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex items-center justify-center py-8 calendar-container h-full">
    <div className="calendar-loading-spinner" />
    <span className="ml-3 calendar-text-secondary">Loading calendar...</span>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="text-center py-8 calendar-container h-full flex flex-col justify-center">
    <div className="text-red-600 mb-4">
      <CalendarIcon size={48} className="mx-auto mb-2" />
      <p className="text-lg font-medium">Error Loading Calendar</p>
      <p className="text-sm">{message}</p>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="text-center py-8 calendar-container h-full flex flex-col justify-center">
    <CalendarIcon size={48} className="mx-auto calendar-text-muted mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Calendar Generated</h3>
    <p className="calendar-text-secondary mb-4">Select notebooks and generate a schedule.</p>
  </div>
);

const SessionTooltipPortal: React.FC<{
  session: StudySession;
  position: { x: number; y: number };
  onViewDetails?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ session, position, onViewDetails, onMouseEnter, onMouseLeave }) => {
  // (new update - Local state to control text expansion inside the tooltip)
  const [isExpanded, setIsExpanded] = useState(false);

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'block': return <BookOpen size={16} className="text-blue-600" />;
      case 'revision-block': return <RotateCcw size={16} className="text-green-600" />;
      case 'revision-interleaved': return <Shuffle size={16} className="text-purple-600" />;
      default: return <CalendarIcon size={16} className="text-gray-600" />;
    }
  };

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - 20,
    transform: 'translate(-50%, -100%)',
    zIndex: 9998,
    pointerEvents: 'auto',
  };

  const toggleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const minutes = session.metadata?.estimatedDuration ?? 0;
  
  // (new update - Render Info icon for practice sessions, wrapped in span to fix TS error)
  const renderSessionContent = () => {
    if (session.type === 'revision-interleaved') {
      return (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-600">Interleaved practice</span>
          <span 
            className=" flex items-center justify-center"
            title="Review flash cards and Quizzes from entire notebook"
          >
             <Info size={13} className="text-gray-400 hover:text-gray-600 transition-colors" />
          </span>
        </div>
      );
    }
    
    if (session.type === 'revision-block') {
      return (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-600">Practice session</span>
          <span 
            className=" flex items-center justify-center"
            title="Review flash cards and Quizzes from this unit"
          >
             <Info size={13} className="text-gray-400 hover:text-gray-600 transition-colors" />
          </span>
        </div>
      );
    }

    // Default: 'block' type renders topics
    const topics = (session.metadata?.topicTitles ?? []).join(', ');
    if (!topics) return null;

    return (
      <p className={`text-xs text-gray-600 mb-2 ${isExpanded ? '' : 'line-clamp-1'}`}>
        {topics}
      </p>
    );
  };

  const showViewDetailsBtn = session.type !== 'revision-interleaved';

  return createPortal(
    <div 
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="session-tooltip calendar-bg-secondary border border-gray-200 rounded-lg shadow-xl p-3 w-72">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {getSessionTypeIcon(session.type)}
            <h3 className="font-semibold text-sm text-gray-900 truncate">
              {session.notebookMeta.fileName}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-gray-600 flex-shrink-0">
            <Clock size={12} />
            <span className="text-xs">{minutes} min</span>
          </div>
        </div>
        
        <p className="text-xs text-gray-700 mb-2 line-clamp-2">
          {session.metadata.sessionTitle}
        </p>
        
        {renderSessionContent()}
        
        {showViewDetailsBtn && (
          <button 
            onClick={toggleDetails}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-2"
          >
            {isExpanded ? 'Hide details' : 'View details'}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
          </button>
        )}

        <div className="pt-2 border-t border-gray-200 flex justify-between text-xs calendar-text-secondary">
          <span>Click to start</span>
          <span>Right-click to complete</span>
        </div>

        <div className="relative h-0">
          <div className="absolute left-1/2 -translate-x-1/2 translate-y-2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white" />
        </div>
      </div>
    </div>,
    document.body
  );
};
export default CalendarMonthView;