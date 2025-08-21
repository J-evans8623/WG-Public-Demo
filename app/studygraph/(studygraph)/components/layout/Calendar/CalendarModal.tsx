/**
 * @file CalendarModal.tsx
 * @description
 *   Updated main calendar interface modal providing comprehensive notebook selection, enhanced schedule
 *   configuration with multi-subject support, and 30/31 day calendar display functionality for the
 *   BloomMap calendar planner system. This component serves as the primary user interface for the
 *   enhanced calendar system, offering intuitive controls for managing study schedules while maintaining
 *   consistency with existing BloomMap modal patterns and design standards. The modal integrates four
 *   main functional areas: notebook selection with metadata display, enhanced schedule configuration
 *   with subjects-per-day settings, monthly calendar view with session management, and performance
 *   analytics. The implementation handles loading states, error management, and user feedback while
 *   providing responsive design and accessibility features optimized for the new calendar layout.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Settings, BookOpen, BarChart3, Users } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { PickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import NotebookSelector from './NotebookSelector';
import CalendarMonthView from './CalendarMonthView';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (meta: PickerFileMeta) => void; // AppLayout's handleFileSelect
}

/**
 * Main calendar modal component that orchestrates the entire enhanced calendar interface
 * including notebook selection, configuration, monthly calendar display, and session launching.
 * Manages tab navigation and coordinates between different calendar subsystems.
 */
const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, onFileSelect }) => {
  console.log('[CalendarModal.tsx][8001] › Calendar modal render, isOpen:', isOpen);

  // Step 1: Access calendar context and local state
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
  } = useCalendar();

  // Step 2: Initialize local state for modal management
  const [activeTab, setActiveTab] = useState<'select' | 'configure' | 'calendar' | 'analytics'>('select');

  /**
   * Handles schedule generation with user feedback and automatic tab navigation.
   * Validates that notebooks are selected before proceeding and provides
   * appropriate feedback for different scenarios and error conditions.
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

    // Validate subjects per day configuration
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

    // Validate max sessions per day
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
   * Handles session launch by creating session launcher metadata and delegating
   * to AppLayout's file selection system for proper document loading and session initiation.
   */
  const handleSessionLaunch = useCallback((sessionId: string) => {
    console.log('[CalendarModal.tsx][8010] › Launching session:', sessionId);

    if (!onFileSelect) {
      console.warn('[CalendarModal.tsx][8011] › No file selection handler provided');
      return;
    }

    const sessionMeta = createSessionLauncher(sessionId);
    if (sessionMeta) {
      console.log('[CalendarModal.tsx][8012] › Session launcher created, delegating to file selection');
      onFileSelect(sessionMeta);
      onClose(); // Close modal after launching session
    } else {
      console.error('[CalendarModal.tsx][8013] › Failed to create session launcher for:', sessionId);
    }
  }, [onFileSelect, createSessionLauncher, onClose]);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-auto max-h-[95vh] overflow-hidden">
        
        {/* Step 5: Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
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

        {/* Step 6: Enhanced Tab Navigation */}
        <div className="flex border-b border-gray-200">
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
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 size={16} className="inline mr-2" />
            Analytics
          </button>
        </div>

        {/* Step 7: Enhanced Tab Content Area */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          
          {/* Notebook Selection Tab */}
          {activeTab === 'select' && (
            <div className="space-y-6">
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
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Enhanced Schedule Configuration
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Customize your study schedule parameters including multi-subject daily planning, 
                  session distribution, and time management preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Basic Session Configuration */}
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

                {/* NEW: Multi-Subject Daily Planning */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <Users size={16} />
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

                {/* Schedule Timing */}
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
            <div className="space-y-6">
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
                    disabled={selectedNotebooks.length === 0 || isLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Generating...' : 'Regenerate Schedule'}
                  </button>
                </div>
              </div>

              {/* Monthly Calendar View */}
              <CalendarMonthView onFileSelect={onFileSelect} />

              {/* Monthly Summary Statistics */}
              {currentMonth && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentMonth.monthlySummary.totalSessions}
                    </div>
                    <div className="text-sm text-gray-600">Total Sessions</div>
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

          {/* NEW: Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Calendar Analytics & Insights
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Track your study patterns, subject distribution, and scheduling effectiveness.
                </p>
              </div>

              {currentMonth ? (
                <div className="space-y-6">
                  {/* Subject Distribution Chart */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-4">Subject Distribution</h4>
                    <div className="space-y-3">
                      {Object.entries(
                        currentMonth.dailyPlans
                          .flatMap(plan => plan.sessions)
                          .reduce((acc, session) => {
                            const notebookId = session.notebookMeta.fileId;
                            if (!acc[notebookId]) {
                              acc[notebookId] = {
                                name: session.notebookMeta.fileName,
                                count: 0,
                                color: session.notebookMeta.color || '#6B7280',
                              };
                            }
                            acc[notebookId].count++;
                            return acc;
                          }, {} as Record<string, { name: string; count: number; color: string }>)
                      ).map(([id, data]) => (
                        <div key={id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: data.color }}
                            ></div>
                            <span className="text-sm font-medium">{data.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">{data.count} sessions</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly Study Load */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-4">Weekly Study Load</h4>
                    <div className="space-y-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                        const daySessions = currentMonth.dailyPlans.filter(
                          plan => plan.date.getDay() === (index + 1) % 7
                        );
                        const avgSessions = daySessions.length > 0 
                          ? daySessions.reduce((sum, plan) => sum + plan.sessions.length, 0) / daySessions.length 
                          : 0;
                        
                        return (
                          <div key={day} className="flex items-center space-x-3">
                            <div className="w-12 text-sm font-medium">{day}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(avgSessions * 20, 100)}%` }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-600 w-16">
                              {avgSessions.toFixed(1)} avg
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Study Efficiency Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {Math.round(currentMonth.monthlySummary.totalStudyTime / currentMonth.monthlySummary.totalSessions)}m
                      </div>
                      <div className="text-sm text-gray-600">Avg Session Length</div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg text-center">
                      <div className="text-lg font-bold text-green-600">
                        {Math.round(currentMonth.dailyPlans.filter(p => p.sessions.length > 0).length / currentMonth.dailyPlans.length * 100)}%
                      </div>
                      <div className="text-sm text-gray-600">Days with Sessions</div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {(currentMonth.monthlySummary.totalSessions / currentMonth.monthlySummary.activeNotebooks.length).toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">Sessions per Subject</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    No Analytics Available
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Generate a schedule to view detailed analytics and insights about your study patterns.
                  </p>
                  <button
                    onClick={() => setActiveTab('configure')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Configure Schedule
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 8: Enhanced Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          
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
                disabled={selectedNotebooks.length === 0 || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Generating...' : 'Generate Calendar'}
              </button>
            )}

            {activeTab === 'calendar' && currentMonth && (
              <button
                onClick={() => setActiveTab('analytics')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                View Analytics
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;