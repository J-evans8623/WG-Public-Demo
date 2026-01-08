/**
 * @file CalendarModal.tsx
 * @description
 *   Main calendar interface modal: notebook selection, simple Day Availability, month view,
 *   session launching, and extension status. Simplified to match the new ScheduleConfig
 *   (DayAvailability only) and using the current date on generate (no date picker).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';
import { PickerFileMeta, StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import NotebookSelector from './NotebookSelector';
import CalendarMonthView from './draft/CalendarMonthView';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import './calendar-theme.css';
import { ALL_DAYS } from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/models/Configuration';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (meta: PickerFileMeta) => void;
}

/**
 * Main calendar modal component: notebook selection (+ day availability), calendar display,
 * session launching, and version/extension notices.
 */
const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, onFileSelect }) => {
  console.log('[CalendarModal.tsx][1001] › Calendar modal render, isOpen:', isOpen);

  // Access calendar context
  const {
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    isLoading,
    error,
    availableNotebooks,
    updateScheduleConfig,
    generateSchedule,
    clearSchedule,
    createSessionLauncher,
    refreshNotebooks,
    notebookVersions,
    // use today as start when generating
    setPlanStartDate,
    updateStudyPlan,
  } = useCalendar();

  const extensionInProgress = isLoading;
  const { requestSessionLaunch } = useSlideShow();

  // Two tabs now: select (with availability) and calendar
  const [activeTab, setActiveTab] = useState<'select' | 'calendar'>('select');

   /**
   * @effect Auto-tab to "Calendar View" when modal opens and there is data
   * @reason
   *   Improves UX by taking users directly to their calendar if it already exists.
   * @behavior
   *   - When `isOpen` becomes true, if `currentMonth?.dailyPlans?.length > 0`, set tab to 'calendar'.
   *   - Otherwise stay on 'select'.
   *   
   */
  useEffect(() => {
    if (!isOpen) return;
    const hasCalendar =
      !!currentMonth && Array.isArray(currentMonth.dailyPlans) && currentMonth.dailyPlans.length > 0;
    if (hasCalendar) {
      setActiveTab('calendar');
    }
  }, [isOpen, currentMonth]);

  /**
   * Manual extension trigger for outdated notebooks (unchanged)
   */
  const handleManualExtensionTrigger = useCallback(async () => {
    if (!notebookVersions) return;

    console.log('[CalendarModal.tsx][1002] › Manual extension trigger requested');

    const outdatedNotebooks = Array.from(notebookVersions.values())
      .filter(v => v.needsUpdate)
      .map(v => v.notebookId);

    if (outdatedNotebooks.length === 0) {
      console.log('[CalendarModal.tsx][1003] › No outdated notebooks found for manual extension');
      return;
    }

    console.log('[CalendarModal.tsx][1004] › Triggering extension for', outdatedNotebooks.length, 'outdated notebooks');

    try {
      await refreshNotebooks();
    } catch (error) {
      console.error('[CalendarModal.tsx][1005] › Error during manual extension trigger:', error);
    }
  }, [notebookVersions, refreshNotebooks]);

  /**
   * Generate schedule:
   *  - set plan start date to "now"
   *  - call generateSchedule()
   *  - switch to calendar tab
   */
  const handleGenerateSchedule = useCallback(async () => {
    console.log('[CalendarModal.tsx][1006] › Generating schedule for', selectedNotebooks.length, 'notebooks');

    if (selectedNotebooks.length === 0) {
      console.warn('[CalendarModal.tsx][1007] › No notebooks selected for schedule generation');
      return;
    }

    try {
      setPlanStartDate(new Date());
      await generateSchedule();
      console.log('[CalendarModal.tsx][1008] › Schedule generated successfully, switching to calendar tab');
      setActiveTab('calendar');
    } catch (error) {
      console.error('[CalendarModal.tsx][1009] › Error generating schedule:', error);
    }
  }, [selectedNotebooks, generateSchedule, setPlanStartDate]);


  
const handleUpdateSchedule = async () => { 
  // Step 1: Delegate to context API which handles fetching metas + merging
  // Step 2: Keep UX (spinners/disabled) controlled by isLoading from context
  await updateStudyPlan();
  setActiveTab('calendar');
};

  /**
   * Launch session via SlideShow context
   */
  const handleSessionLaunch = useCallback((sessionId: string) => {
    console.log('[CalendarModal.tsx][1014] › Launching session:', sessionId);

    if (!requestSessionLaunch) {
      console.warn('[CalendarModal.tsx][1015] › No session launch handler available');
      return;
    }

    const sessionMeta = createSessionLauncher(sessionId);
    if (sessionMeta && currentMonth) {
      let targetSession: StudySession | undefined;

      for (const dailyPlan of currentMonth.dailyPlans) {
        targetSession = dailyPlan.sessions.find(s => s.id === sessionId);
        if (targetSession) break;
      }

      if (targetSession) {
        console.log('[CalendarModal.tsx][1016] › Requesting session launch with file switch to:', sessionMeta.docId);

        requestSessionLaunch({
          sessionId: sessionId,
          sessionData: targetSession,
          targetFileId: sessionMeta.docId
        });

        onFileSelect(sessionMeta);
        onClose();
      } else {
        console.error('[CalendarModal.tsx][1017] › Session data not found for:', sessionId);
      }
    } else {
      console.error('[CalendarModal.tsx][1018] › Failed to create session launcher or no current month data');
    }
  }, [requestSessionLaunch, createSessionLauncher, currentMonth, onFileSelect, onClose]);


  if (!isOpen) return null;

  // Version notices
  const hasVersionMismatch = notebookVersions && Array.from(notebookVersions.values()).some(v => v.needsUpdate);
  const extensionInProgressState = isLoading || extensionInProgress;

  // Logic to determine if we are generating fresh or updating
  // If we have a currentMonth (implying a plan exists), we are in "Update" mode even on the select tab.
  const hasExistingPlan = !!currentMonth;

  // Helpers for DayAvailability UI
  const allDays: Array<'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'> = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
  ];

  const toggleDay = (day: string) => {
    const current = scheduleConfig?.DayAvailability ?? [];
    const exists = current.includes(day as any);
    const next = exists ? current.filter(d => d !== day) : [...current, day as any];
    updateScheduleConfig({ DayAvailability: next });
  };

  return (
    <div className="calendar-modal-overlay calendar-container">
      <div className="calendar-modal-content">
        {/* Header */}
        <div className="calendar-modal-header">
          <div className="calendar-modal-title">
            <Calendar size={24} className="text-blue-600" />
            <h2>Study Planner</h2>
          </div>
          <button
            onClick={onClose}
            className="calendar-btn-icon"
            aria-label="Close calendar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Extension status */}
        {extensionInProgressState && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="calendar-loading-spinner"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  {extensionInProgress ? 'Updating Schedule...' : 'Loading...'}
                </p>
                <p className="text-xs text-blue-600">
                  {extensionInProgress
                    ? 'Detected new content and extending your study plan'
                    : 'Please wait while we process your request'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Version mismatch notification */}
        {hasVersionMismatch && !extensionInProgress && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle size={16} className="text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Content Updates Available
                  </p>
                  <p className="text-xs text-amber-600">
                    Some notebooks have new lesson content that will be added to your schedule
                  </p>
                </div>
              </div>
              <button
                onClick={handleManualExtensionTrigger}
                disabled={extensionInProgressState}
                className="calendar-btn calendar-btn-sm calendar-btn-secondary"
              >
                {extensionInProgressState ? 'Updating...' : 'Update Now'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs: only Select + Calendar */}
        <div className="calendar-tab-navigation">
          <button
            onClick={() => setActiveTab('select')}
            className={`calendar-tab-button ${activeTab === 'select' ? 'active' : ''}`}
          >
            <BookOpen className="calendar-tab-icon" />
            Select Notebooks ({selectedNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`calendar-tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          >
            <Calendar className="calendar-tab-icon" />
            Calendar View
          </button>
        </div>

        {/* Body */}
        <div className="calendar-modal-body">
          {/* Select Tab (with Day Availability) */}
          {activeTab === 'select' && (
            <div className="space-y-6 h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select Notebooks for Calendar Planning
                </h3>
                <p className="calendar-text-secondary text-sm mb-4">
                  Choose the notebooks you want in your study schedule and indicate which days you’re generally available to study.
                </p>
              </div>
                            {/* Day Availability */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-800">
                  Day Availability
                </h4>
                <p className="calendar-text-secondary text-sm">
                  Select the days of the week you’re available to study. We’ll use today as your start date.
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {ALL_DAYS.map((day) => {
                    const isSelected = scheduleConfig.DayAvailability?.includes(day as any);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-2 py-1 text-xs rounded ${
                          isSelected ? 'calendar-btn-primary' : 'calendar-btn-outline'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <NotebookSelector
                notebooks={availableNotebooks}
                loading={isLoading}
                onRefresh={refreshNotebooks}
              />


            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 h-full">
              <CalendarMonthView
                onFileSelect={onFileSelect}
                onSessionLaunch={handleSessionLaunch}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="calendar-modal-footer">
          {/* Error */}
          {error && (
            <div className="flex-1 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 ml-auto">
{activeTab === 'select' && (
              /* update - 4: Dynamic button text and action based on plan existence */
              hasExistingPlan ? (
                <button
                  onClick={handleUpdateSchedule}
                  disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                  className="calendar-btn calendar-btn-secondary"
                >
                  {extensionInProgressState ? 'Updating...' : 'Update Schedule'}
                </button>
              ) : (
                <button
                  onClick={handleGenerateSchedule}
                  disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                  className="calendar-btn calendar-btn-primary"
                >
                  {extensionInProgressState ? 'Creating...' : 'Generate Schedule'}
                </button>
              )
            )}

            {activeTab === 'calendar' && (
              <>
                <button
                  onClick={clearSchedule}
                  className="calendar-btn calendar-btn-outline"
                >
                  Clear Schedule
                </button>
                <button
                  onClick={handleUpdateSchedule}
                  disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                  className="calendar-btn calendar-btn-secondary"
                >
                  {extensionInProgressState ? 'Updating...' : 'Update Schedule'}
                </button>
                <button
                  onClick={() => setActiveTab('select')}
                  className="calendar-btn calendar-btn-primary"
                >
                  Add More Notebooks
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
