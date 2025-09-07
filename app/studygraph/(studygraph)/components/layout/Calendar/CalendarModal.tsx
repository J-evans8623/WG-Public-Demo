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
 *   existing BloomMap modal patterns. The implementation handles loading states, error management, extension
 *   progress tracking, and user feedback while providing responsive design and accessibility features
 *   optimized for the dynamic calendar layout with real-time content monitoring and seamless schedule
 *   extension capabilities that preserve established learning patterns while incorporating new lesson content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Settings, BookOpen, BarChart3, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { PickerFileMeta, StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import NotebookSelector from './NotebookSelector';
import CalendarMonthView from './CalendarMonthView';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (meta: PickerFileMeta) => void; // AppLayout's handleFileSelect
}

/**
 * Main calendar modal component that orchestrates the entire enhanced calendar interface
 * including notebook selection, configuration, monthly calendar display, session launching,
 * and dynamic extension status monitoring with comprehensive version detection capabilities.
 */
const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, onFileSelect }) => {
  console.log('[CalendarModal.tsx][8001] › Calendar modal render with Phase 4 extensions, isOpen:', isOpen);

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

  const extensionInProgress =isLoading
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
    
    console.log('[CalendarModal.tsx][8080] › Manual extension trigger requested');
    
    // Step 3: Find notebooks that need updates
    const outdatedNotebooks = Array.from(notebookVersions.values())
      .filter(versionState => versionState.needsUpdate)
      .map(versionState => versionState.notebookId);
    
    if (outdatedNotebooks.length === 0) {
      console.log('[CalendarModal.tsx][8081] › No outdated notebooks found for manual extension');
      return;
    }
    
    console.log('[CalendarModal.tsx][8082] › Triggering extension for', outdatedNotebooks.length, 'outdated notebooks');
    
    // Step 4: The actual extension will be triggered automatically by the CalendarContext
    // when it detects the version changes. Here we just refresh to ensure latest versions.
    try {
      await refreshNotebooks();
    } catch (error) {
      console.error('[CalendarModal.tsx][8083] › Error during manual extension trigger:', error);
    }
  }, [notebookVersions, refreshNotebooks]);

  /**
   * Handles schedule generation with user feedback and automatic tab navigation.
   * Enhanced with Phase 4 version tracking initialization for newly generated schedules.
   */
  const handleGenerateSchedule = useCallback(async () => {
    console.log('[CalendarModal.tsx][8002] › Generating schedule for', selectedNotebooks.length, 'notebooks');

    if (selectedNotebooks.length === 0) {
      console.warn('[CalendarModal.tsx][8003] › No notebooks selected for schedule generation');
      return;
    }

    try {
      await generateSchedule();
      console.log('[CalendarModal.tsx][8004] › Schedule generated successfully, switching to calendar tab');
      setActiveTab('calendar');
    } catch (error) {
      console.error('[CalendarModal.tsx][8005] › Error generating schedule:', error);
    }
  }, [selectedNotebooks, generateSchedule]);

  /**
   * Enhanced configuration update handler with validation for new multi-subject
   * configuration options including subjects per day and session distribution.
   */
  const handleConfigUpdate = useCallback((field: string, value: any) => {
    console.log('[CalendarModal.tsx][8006] › Updating configuration field:', field, 'value:', value);

    if (field === 'subjectsPerDay') {
      const numValue = parseInt(value);
      if (numValue < 1) {
        console.warn('[CalendarModal.tsx][8007] › Invalid subjects per day value, using minimum of 1');
        value = 1;
      } else if (numValue > selectedNotebooks.length && selectedNotebooks.length > 0) {
        console.warn('[CalendarModal.tsx][8008] › Subjects per day exceeds available notebooks, adjusting');
        value = selectedNotebooks.length;
      }
    }

    if (field === 'maxSessionsPerDay') {
      const numValue = parseInt(value);
      if (numValue < scheduleConfig.subjectsPerDay) {
        console.warn('[CalendarModal.tsx][8009] › Max sessions less than subjects per day, adjusting');
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
    console.log('[CalendarModal.tsx][8010] › Launching session through SlideShow context:', sessionId);

    if (!requestSessionLaunch) {
      console.warn('[CalendarModal.tsx][8011] › No session launch handler available');
      return;
    }

    const sessionMeta = createSessionLauncher(sessionId);
    if (sessionMeta && currentMonth) {
      let targetSession: StudySession | undefined;
      
      // Step 5: Find session data across all daily plans (including dynamically extended ones)
      for (const dailyPlan of currentMonth.dailyPlans) {
        targetSession = dailyPlan.sessions.find(s => s.id === sessionId);
        if (targetSession) break;
      }
      
      if (targetSession) {
        console.log('[CalendarModal.tsx][8012] › Requesting session launch with file switch to:', sessionMeta.docId);
        
        // Step 6: Request session launch through enhanced SlideShow context
        requestSessionLaunch({
          sessionId: sessionId,
          sessionData: targetSession,
          targetFileId: sessionMeta.docId
        });
        
        // Step 7: Initiate file switch through AppLayout if needed
        onFileSelect(sessionMeta);
        onClose();
        
      } else {
        console.error('[CalendarModal.tsx][8013] › Session data not found for:', sessionId);
      }
    } else {
      console.error('[CalendarModal.tsx][8014] › Failed to create session launcher or no current month data');
    }
  }, [requestSessionLaunch, createSessionLauncher, currentMonth, onFileSelect, onClose]);

  // Step 8: Load notebooks when modal opens if not already loaded
  useEffect(() => {
    if (isOpen && availableNotebooks.length === 0) {
      refreshNotebooks();
    }
  }, [isOpen, availableNotebooks.length, refreshNotebooks]);

  // Step 9: Early return if modal is closed
  if (!isOpen) {
    return null;
  }

  // Step 10: Calculate version mismatch state for UI display
  const hasVersionMismatch = notebookVersions && Array.from(notebookVersions.values()).some(v => v.needsUpdate);
  const extensionInProgressState = isLoading || extensionInProgress;

return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-auto h-[90vh] overflow-hidden flex flex-col">
        
        {/* Step 6: Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Calendar size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Study Calendar Planner</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close calendar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Step 7: Phase 4 Dynamic Extension Status Display */}
        {extensionInProgressState && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <RefreshCw size={16} className={`text-blue-600 ${extensionInProgressState ? 'animate-spin' : ''}`} />
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

        {/* Step 8: Phase 4 Version Mismatch Notification */}
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
                className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {extensionInProgressState ? 'Updating...' : 'Update Now'}
              </button>
            </div>
          </div>
        )}

        {/* Step 9: Simplified Tab Navigation (removed analytics) */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('select')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'select'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen size={16} className="inline mr-2" />
            Select Notebooks ({selectedNotebooks.length})
          </button>
          <button
            onClick={() => setActiveTab('configure')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'configure'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            Configure Schedule
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            Calendar View ({currentMonth?.dailyPlans.length || 0} days)
          </button>
        </div>

        {/* Step 10: Enhanced Tab Content Area with proper flex layout */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Notebook Selection Tab */}
          {activeTab === 'select' && (
            <div className="space-y-6 h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select Notebooks for Calendar Planning
                </h3>
                <p className="text-gray-600 text-sm mb-4">
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

              {selectedNotebooks.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800 text-sm mb-2">
                    <strong>{selectedNotebooks.length} notebook(s) selected.</strong>
                  </p>
                  <p className="text-blue-700 text-sm">
                    The calendar will distribute these subjects across your study days according to 
                    your configuration settings. Proceed to configure your schedule parameters.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Schedule Configuration Tab */}
          {activeTab === 'configure' && (
            <div className="space-y-6 h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Schedule Configuration
                </h3>
                <p className="text-gray-600 text-sm mb-4">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum total study sessions per day across all subjects
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Time Slots
                    </label>
                    <div className="space-y-2">
                      {['morning', 'afternoon', 'evening'].map((slot) => (
                        <label key={slot} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={scheduleConfig.preferredTimeSlots.includes(slot as any)}
                            onChange={(e) => {
                              const newSlots = e.target.checked
                                ? [...scheduleConfig.preferredTimeSlots, slot as any]
                                : scheduleConfig.preferredTimeSlots.filter(s => s !== slot);
                              handleConfigUpdate('preferredTimeSlots', newSlots);
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm capitalize">{slot}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select which days of the week to schedule study sessions
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration Summary */}
              {selectedNotebooks.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-medium text-gray-800 mb-2">Configuration Summary</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Daily Subjects:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.subjectsPerDay}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Max Sessions/Day:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.maxSessionsPerDay}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Study Days/Week:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.daysPerWeek.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Time Slots:</span>
                      <span className="ml-2 font-medium">{scheduleConfig.preferredTimeSlots.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Calendar Display Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 h-full">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Monthly Study Calendar
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {currentMonth ? (
                      <>
                        {currentMonth.monthlySummary.totalSessions} study sessions planned across{' '}
                        {currentMonth.monthlySummary.activeNotebooks.length} subject(s)
                        {hasVersionMismatch && (
                          <span className="ml-2 text-amber-600 font-medium">
                            • Updates available
                          </span>
                        )}
                      </>
                    ) : (
                      'Generate a schedule to view your monthly calendar'
                    )}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={clearSchedule}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Clear Schedule
                  </button>
                  <button
                    onClick={handleGenerateSchedule}
                    disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {extensionInProgressState ? 'Updating...' : 'Regenerate Schedule'}
                  </button>
                </div>
              </div>

              {/* Monthly Calendar View */}
              <CalendarMonthView 
                onFileSelect={onFileSelect}
                onSessionLaunch={handleSessionLaunch}
              />

              {/* Simplified Monthly Summary Statistics */}
              {currentMonth && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentMonth.monthlySummary.totalSessions}
                    </div>
                    <div className="text-sm text-gray-600">Total Sessions</div>
                    {extensionInProgress && (
                      <div className="text-xs text-blue-500 mt-1">Extending...</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(currentMonth.monthlySummary.totalStudyTime / 60)}h
                    </div>
                    <div className="text-sm text-gray-600">Study Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {currentMonth.monthlySummary.activeNotebooks.length}
                    </div>
                    <div className="text-sm text-gray-600">Active Subjects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(currentMonth.monthlySummary.completionRate)}%
                    </div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 11: Enhanced Footer Actions with fixed positioning */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          
          {/* Error Display */}
          {error && (
            <div className="flex-1 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            
            {activeTab === 'select' && selectedNotebooks.length > 0 && (
              <button
                onClick={() => setActiveTab('configure')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Configure Schedule
              </button>
            )}
            
            {activeTab === 'configure' && (
              <button
                onClick={handleGenerateSchedule}
                disabled={selectedNotebooks.length === 0 || extensionInProgressState}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {extensionInProgressState ? 'Updating..' : 'Generate Calendar'}
              </button>
            )}

            {activeTab === 'calendar' && currentMonth && (
              <button
                onClick={() => setActiveTab('select')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Add More Notebooks
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;