/**
 * @file CalendarModal.tsx
 * @description
 *   Enhanced main calendar interface modal providing comprehensive notebook selection, schedule configuration
 *   with multi-subject support, 30/31 day calendar display functionality, and dynamic extension capabilities
 *   for the BloomMap calendar planner system. This component serves as the primary user interface for the
 *   enhanced calendar system with Phase 4 dynamic extension features including version monitoring, automatic
 *   schedule updates when notebook content changes, and user feedback for extension operations. The modal
 *   integrates version detection UI components that display when notebooks have been updated with new lesson
 *   content, provides extension progress indicators during schedule updates, and maintains consistency with
 *   established BloomMap modal patterns. Updated with comprehensive brand theme integration through the new
 *   CSS framework, implementing professional styling with sage green and blue accents while maintaining
 *   functionality and accessibility standards. Further refined with improved button placement and cleaner
 *   visual hierarchy for better user experience.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Settings, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { PickerFileMeta, StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import NotebookSelector from './NotebookSelector';
import CalendarMonthView from './CalendarMonthView';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import './calendar-theme.css';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (meta: PickerFileMeta) => void;
}

/**
 * Main calendar modal component that orchestrates the entire enhanced calendar interface
 * including notebook selection, configuration, monthly calendar display, session launching,
 * and dynamic extension status monitoring with comprehensive version detection capabilities.
 * Enhanced with brand-consistent styling and professional visual design with improved layout.
 */
const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, onFileSelect }) => {
  console.log('[CalendarModal.tsx][1001] › Calendar modal render with improved layout, isOpen:', isOpen);

  // Step 1: Access calendar context and enhanced state for Phase 4
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
  } = useCalendar();

  const extensionInProgress = isLoading;
  const { requestSessionLaunch } = useSlideShow();

  // Step 2: Initialize local state for modal management
  const [activeTab, setActiveTab] = useState<'select' | 'configure' | 'calendar'>('select');

  /**
   * Handles manual extension trigger for outdated notebooks when user clicks update button.
   * Provides manual control over extension process while maintaining automatic detection capabilities
   * and ensuring proper coordination with the dynamic extension system.
   */
  const handleManualExtensionTrigger = useCallback(async () => {
    if (!notebookVersions) return;
    
    console.log('[CalendarModal.tsx][1002] › Manual extension trigger requested');
    
    const outdatedNotebooks = Array.from(notebookVersions.values())
      .filter(versionState => versionState.needsUpdate)
      .map(versionState => versionState.notebookId);
    
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
   * Handles schedule generation with user feedback and automatic tab navigation.
   * Enhanced with Phase 4 version tracking initialization for newly generated schedules.
   */
  const handleGenerateSchedule = useCallback(async () => {
    console.log('[CalendarModal.tsx][1006] › Generating schedule for', selectedNotebooks.length, 'notebooks');

    if (selectedNotebooks.length === 0) {
      console.warn('[CalendarModal.tsx][1007] › No notebooks selected for schedule generation');
      return;
    }

    try {
      await generateSchedule();
      console.log('[CalendarModal.tsx][1008] › Schedule generated successfully, switching to calendar tab');
      setActiveTab('calendar');
    } catch (error) {
      console.error('[CalendarModal.tsx][1009] › Error generating schedule:', error);
    }
  }, [selectedNotebooks, generateSchedule]);

  /**
   * Enhanced configuration update handler with validation for new multi-subject
   * configuration options including subjects per day and session distribution.
   */
  const handleConfigUpdate = useCallback((field: string, value: any) => {
    console.log('[CalendarModal.tsx][1010] › Updating configuration field:', field, 'value:', value);

    if (field === 'subjectsPerDay') {
      const numValue = parseInt(value);
      if (numValue < 1) {
        console.warn('[CalendarModal.tsx][1011] › Invalid subjects per day value, using minimum of 1');
        value = 1;
      } else if (numValue > selectedNotebooks.length && selectedNotebooks.length > 0) {
        console.warn('[CalendarModal.tsx][1012] › Subjects per day exceeds available notebooks, adjusting');
        value = selectedNotebooks.length;
      }
    }

    if (field === 'maxSessionsPerDay') {
      const numValue = parseInt(value);
      if (numValue < scheduleConfig.subjectsPerDay) {
        console.warn('[CalendarModal.tsx][1013] › Max sessions less than subjects per day, adjusting');
        value = scheduleConfig.subjectsPerDay;
      }
    }

    const updates: any = {};
    updates[field] = value;

    updateScheduleConfig(updates);
  }, [selectedNotebooks.length, scheduleConfig.subjectsPerDay, updateScheduleConfig]);

  /**
   * Enhanced session launch handler with Phase 4 integration for dynamic content handling.
   * Coordinates with SlideShow context state machine for proper file switching and content
   * generation while handling dynamically extended schedules and version-aware session data.
   */
  const handleSessionLaunch = useCallback((sessionId: string) => {
    console.log('[CalendarModal.tsx][1014] › Launching session through SlideShow context:', sessionId);

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

  // Step 3: Load notebooks when modal opens if not already loaded
  useEffect(() => {
    if (isOpen && availableNotebooks.length === 0) {
      refreshNotebooks();
    }
  }, [isOpen, availableNotebooks.length, refreshNotebooks]);

  // Step 4: Early return if modal is closed
  if (!isOpen) {
    return null;
  }

  // Step 5: Calculate version mismatch state for UI display
  const hasVersionMismatch = notebookVersions && Array.from(notebookVersions.values()).some(v => v.needsUpdate);
  const extensionInProgressState = isLoading || extensionInProgress;

  return (
    <div className="calendar-modal-overlay calendar-container">
      <div className="calendar-modal-content">
        
        {/* Step 6: Modal Header with brand styling */}
        <div className="calendar-modal-header">
          <div className="calendar-modal-title">
            <Calendar size={24} className="text-blue-600" />
            <h2>Study Calendar Planner</h2>
          </div>
          <button
            onClick={onClose}
            className="calendar-btn-icon"
            aria-label="Close calendar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Step 7: Extension Status Display with brand styling */}
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
                    : 'Please wait while we process your request'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 8: Version Mismatch Notification with brand styling */}
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

        {/* Step 9: Tab Navigation with brand theme */}
        <div className="calendar-tab-navigation">
          <button
            onClick={() => setActiveTab('select')}
            className={`calendar-tab-button ${activeTab === 'select' ? 'active' : ''}`}
          >
            <BookOpen className="calendar-tab-icon" />
            Select Notebooks ({selectedNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab('configure')}
            className={`calendar-tab-button ${activeTab === 'configure' ? 'active' : ''}`}
          >
            <Settings className="calendar-tab-icon" />
            Configure Schedule
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`calendar-tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          >
            <Calendar className="calendar-tab-icon" />
            Calendar View ({currentMonth?.dailyPlans.length || 0} days)
          </button>
        </div>

        {/* Step 10: Tab Content Area */}
        <div className="calendar-modal-body">
          
          {/* Notebook Selection Tab */}
          {activeTab === 'select' && (
            <div className="space-y-6 h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select Notebooks for Calendar Planning
                </h3>
                <p className="calendar-text-secondary text-sm mb-4">
                  Choose the notebooks you want to include in your study schedule. 
                  The calendar will create balanced study sessions across all selected notebooks with 
                  optimal subject distribution per day.
                </p>
              </div>

              <NotebookSelector
                notebooks={availableNotebooks}
                loading={isLoading}
                onRefresh={refreshNotebooks}
              />

            </div>
          )}

          {/* Enhanced Schedule Configuration Tab */}
          {activeTab === 'configure' && (
            <div className="space-y-6 h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Schedule Configuration
                </h3>
                <p className="calendar-text-secondary text-sm mb-4">
                  Customize your study schedule parameters including multi-subject daily planning, 
                  session distribution, and time management preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Session Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <BookOpen size={16} />
                    Session Settings
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics per Study Session
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={scheduleConfig.unitsPerBlockSession}
                      onChange={(e) => handleConfigUpdate('unitsPerBlockSession', parseInt(e.target.value))}
                      className="calendar-input"
                    />
                    <p className="calendar-help-text">
                      Number of topics to study in each session (recommended: 3)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Review Sessions per Lesson
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={scheduleConfig.revisionsPerLesson}
                      onChange={(e) => handleConfigUpdate('revisionsPerLesson', parseInt(e.target.value))}
                      className="calendar-input"
                    />
                    <p className="calendar-help-text">
                      Number of spaced review sessions for each lesson (recommended: 2)
                    </p>
                  </div>
                </div>

                {/* Multi-Subject Daily Planning section */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <Settings size={16} />
                    Daily Subject Distribution
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subjects per Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedNotebooks.length || 10}
                      value={scheduleConfig.subjectsPerDay}
                      onChange={(e) => handleConfigUpdate('subjectsPerDay', parseInt(e.target.value))}
                      className="calendar-input"
                    />
                    <p className="calendar-help-text">
                      Number of different subjects to study each day (default: 3)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Sessions per Day
                    </label>
                    <input
                      type="number"
                      min={scheduleConfig.subjectsPerDay}
                      max="12"
                      value={scheduleConfig.maxSessionsPerDay}
                      onChange={(e) => handleConfigUpdate('maxSessionsPerDay', parseInt(e.target.value))}
                      className="calendar-input"
                    />
                    <p className="calendar-help-text">
                      Maximum total study sessions per day across all subjects
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Time Slots
                    </label>
                    <div className="space-y-2">
                      {['morning', 'afternoon', 'evening'].map((slot) => (
                        <label key={slot} className="calendar-label-inline">
                          <input
                            type="checkbox"
                            checked={scheduleConfig.preferredTimeSlots.includes(slot as any)}
                            onChange={(e) => {
                              const newSlots = e.target.checked
                                ? [...scheduleConfig.preferredTimeSlots, slot as any]
                                : scheduleConfig.preferredTimeSlots.filter(s => s !== slot);
                              handleConfigUpdate('preferredTimeSlots', newSlots);
                            }}
                            className="calendar-checkbox"
                          />
                          <span className="text-sm capitalize">{slot}</span>
                        </label>
                      ))}
                    </div>
                    <p className="calendar-help-text">
                      Select preferred time slots for scheduling sessions
                    </p>
                  </div>
                </div>

                {/* Schedule Timing section */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <Calendar size={16} />
                    Schedule Timing
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Start Date
                    </label>
                    <input
                      type="date"
                      value={scheduleConfig.startDate.toISOString().split('T')[0]}
                      onChange={(e) => handleConfigUpdate('startDate', new Date(e.target.value))}
                      className="calendar-input"
                    />
                    <p className="calendar-help-text">
                      When to start your study schedule
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Study Days
                    </label>
                    <div className="grid grid-cols-7 gap-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <button
                          key={day}
                          onClick={() => {
                            const newDays = scheduleConfig.daysPerWeek.includes(index)
                              ? scheduleConfig.daysPerWeek.filter(d => d !== index)
                              : [...scheduleConfig.daysPerWeek, index].sort();
                            handleConfigUpdate('daysPerWeek', newDays);
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            scheduleConfig.daysPerWeek.includes(index)
                              ? 'calendar-btn-primary'
                              : 'calendar-btn-outline'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="calendar-help-text">
                      Select which days of the week to schedule study sessions
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration Summary */}
              {selectedNotebooks.length > 0 && (
                <div className="p-4 calendar-bg-primary rounded-lg">
                  <h5 className="font-medium text-gray-800 mb-2">Configuration Summary</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="calendar-text-secondary">Daily Subjects:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.subjectsPerDay}</span>
                    </div>
                    <div>
                      <span className="calendar-text-secondary">Max Sessions/Day:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.maxSessionsPerDay}</span>
                    </div>
                    <div>
                      <span className="calendar-text-secondary">Study Days/Week:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.daysPerWeek.length}</span>
                    </div>
                    <div>
                      <span className="calendar-text-secondary">Time Slots:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.preferredTimeSlots.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Calendar Display Tab - Simplified */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 h-full">
              {/* Monthly Calendar View */}
              <CalendarMonthView 
                onFileSelect={onFileSelect}
                onSessionLaunch={handleSessionLaunch}
              />
            </div>
          )}
        </div>

        {/* Step 11: Enhanced Footer Actions with consolidated buttons */}
        <div className="calendar-modal-footer">
          
          {/* Error Display */}
          {error && (
            <div className="flex-1 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {/* Action Buttons - Consolidated */}
          <div className="flex gap-3 ml-auto">
            {activeTab === 'select' && selectedNotebooks.length > 0 && (
              <button
                onClick={() => setActiveTab('configure')}
                className="calendar-btn calendar-btn-primary"
              >
                Configure Schedule
              </button>
            )}
            
            {activeTab === 'configure' && (
              <button
                onClick={handleGenerateSchedule}
                disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                className="calendar-btn calendar-btn-primary"
              >
                {extensionInProgressState ? 'Updating..' : 'Generate Calendar'}
              </button>
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
                  onClick={handleGenerateSchedule}
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