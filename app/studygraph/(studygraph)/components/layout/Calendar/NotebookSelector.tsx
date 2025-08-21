/**
 * @file NotebookSelector.tsx
 * @description
 *   Enhanced checkbox-based interface for selecting notebooks with comprehensive metadata display, color indicators,
 *   and advanced filtering capabilities for the BloomMap calendar planner system. This component provides clear
 *   visual feedback for notebook selection state through color-coded indicators, shows relevant metadata including
 *   lesson unit counts and last updated timestamps, and includes robust search functionality for managing large
 *   notebook collections efficiently. The implementation handles loading states, empty states, and error conditions
 *   while maintaining responsive design and accessibility standards throughout. The component integrates seamlessly
 *   with CalendarContext for selection state management and provides intuitive controls for users to build their
 *   study schedule from available notebooks with visual distinction through color coding. Search functionality
 *   filters notebooks by name while preserving selection state, and enhanced metadata display helps users make
 *   informed decisions about which notebooks to include in their calendar planning with immediate visual feedback.
 *
 * Responsibilities:
 *   - Display available notebooks with enhanced metadata and color indicators
 *   - Handle notebook selection/deselection through CalendarContext integration
 *   - Provide robust search and filtering capabilities for large notebook collections
 *   - Show loading states, empty states, and error conditions with proper feedback
 *   - Maintain selection state consistency during filtering and refresh operations
 *   - Display color-coded visual indicators for notebook identification
 *   - Provide accessibility support and responsive design for various screen sizes
 *   - Integration with enhanced NotebookSummary interface including color properties
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, BookOpen, Clock, RefreshCw, Check } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { NotebookSummary } from '@/app/Library/Definitions/CalendarDefinitions';

interface NotebookSelectorProps {
  notebooks: NotebookSummary[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Enhanced notebook selection component that displays available notebooks with color indicators
 * and comprehensive metadata. Provides search functionality and integrates with calendar context
 * for selection state management with visual feedback and accessibility features.
 */
const NotebookSelector: React.FC<NotebookSelectorProps> = ({
  notebooks,
  loading,
  onRefresh,
}) => {
  console.log('[NotebookSelector.tsx][4001] › Rendering enhanced notebook selector with', notebooks.length, 'notebooks');

  // Step 1: Access calendar context for selection state management
  const { selectedNotebooks, selectNotebook, deselectNotebook } = useCalendar();

  // Step 2: Initialize local state for search and filtering with enhanced functionality
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Filters notebooks based on search term while preserving original order and selection state.
   * Search is case-insensitive and matches against notebook file names to help users quickly
   * find specific notebooks in large collections with enhanced performance optimization.
   */
  const filteredNotebooks = useMemo(() => {
    if (!searchTerm.trim()) {
      console.log('[NotebookSelector.tsx][4002] › No search term, returning all', notebooks.length, 'notebooks');
      return notebooks;
    }

    const filtered = notebooks.filter(notebook =>
      notebook.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    console.log('[NotebookSelector.tsx][4003] › Filtered to', filtered.length, 'notebooks for search term:', searchTerm);
    return filtered;
  }, [notebooks, searchTerm]);

  /**
   * Handles notebook selection toggle with comprehensive state management and validation.
   * Updates selection state through calendar context and provides appropriate feedback
   * for selection and deselection actions with enhanced error handling.
   */
  const handleNotebookToggle = useCallback((notebookId: string, isSelected: boolean) => {
    console.log('[NotebookSelector.tsx][4004] › Toggling notebook selection:', notebookId, 'selected:', isSelected);

    if (isSelected) {
      selectNotebook(notebookId);
    } else {
      deselectNotebook(notebookId);
    }
  }, [selectNotebook, deselectNotebook]);

  /**
   * Formats the last updated timestamp for display in notebook cards with enhanced formatting.
   * Provides human-readable relative time formatting to help users understand the recency
   * of notebook content and updates with intelligent time period detection.
   */
  const formatLastUpdated = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  /**
   * Gets appropriate color for notebook indicator with fallback handling.
   * Ensures consistent visual presentation across different notebook states
   * and provides accessible color schemes for enhanced user experience.
   */
  const getNotebookColor = useCallback((notebook: NotebookSummary) => {
    return notebook.color || '#6B7280'; // Default gray if no color assigned
  }, []);

  return (
    <div className="space-y-4">
      
      {/* Step 3: Enhanced Search and Actions Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notebooks by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
        </div>
        
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh notebook list"
          aria-label="Refresh available notebooks"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Step 4: Enhanced Selection Summary with Color Indicators */}
      {selectedNotebooks.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check size={16} className="text-blue-600" />
            <p className="text-blue-800 text-sm font-medium">
              {selectedNotebooks.length} notebook{selectedNotebooks.length !== 1 ? 's' : ''} selected for calendar planning
            </p>
          </div>
          
          {/* Step 5: Show selected notebook colors */}
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedNotebooks.slice(0, 5).map(notebookId => {
              const notebook = notebooks.find(n => n.fileId === notebookId);
              if (!notebook) return null;
              
              return (
                <div key={notebookId} className="flex items-center gap-2 px-2 py-1 bg-white rounded-md border">
                  <div 
                    className="w-3 h-3 rounded-full border border-gray-200"
                    style={{ backgroundColor: getNotebookColor(notebook) }}
                  />
                  <span className="text-xs text-gray-700 truncate max-w-24">
                    {notebook.fileName}
                  </span>
                </div>
              );
            })}
            {selectedNotebooks.length > 5 && (
              <div className="px-2 py-1 bg-gray-100 rounded-md border">
                <span className="text-xs text-gray-600">
                  +{selectedNotebooks.length - 5} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 6: Enhanced Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading available notebooks...</span>
        </div>
      )}

      {/* Step 7: Enhanced Empty States with Better UX */}
      {!loading && notebooks.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Notebooks Available
          </h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            You dont have any notebooks with lesson content available for calendar planning. 
            Create some notebooks with lesson units to get started.
          </p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh List
          </button>
        </div>
      )}

      {!loading && filteredNotebooks.length === 0 && notebooks.length > 0 && (
        <div className="text-center py-12">
          <Search size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Matching Notebooks
          </h3>
          <p className="text-gray-600 mb-4">
            No notebooks match your search term. Try adjusting your search.
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Step 8: Enhanced Notebook Grid with Color Indicators */}
      {!loading && filteredNotebooks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotebooks.map((notebook) => {
            const isSelected = selectedNotebooks.includes(notebook.fileId);
            const notebookColor = getNotebookColor(notebook);
            
            return (
              <div
                key={notebook.fileId}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onClick={() => handleNotebookToggle(notebook.fileId, !isSelected)}
              >
                
                {/* Step 9: Enhanced Notebook Header with Color Indicator */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleNotebookToggle(notebook.fileId, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Enhanced Color Indicator */}
                    <div 
                      className="w-5 h-5 rounded-full border-2 border-gray-200 shadow-sm"
                      style={{ backgroundColor: notebookColor }}
                      title={`${notebook.fileName} color indicator`}
                    />
                    
                    <BookOpen 
                      size={16} 
                      className={isSelected ? 'text-blue-600' : 'text-gray-500'} 
                    />
                  </div>
                </div>

                {/* Step 10: Enhanced Notebook Title */}
                <h4 className={`font-medium mb-3 line-clamp-2 ${
                  isSelected ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {notebook.fileName}
                </h4>

                {/* Step 11: Enhanced Notebook Metadata */}
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <BookOpen size={12} />
                      <span>{notebook.totalUnits} lesson unit{notebook.totalUnits !== 1 ? 's' : ''}</span>
                    </div>
                    
                    {/* Study time estimation */}
                    <div className="text-xs text-gray-500">
                      ~{Math.round(notebook.totalUnits * 15 / 60)}h study time
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>Updated {formatLastUpdated(notebook.lastUpdated)}</span>
                  </div>
                </div>

                {/* Step 12: Enhanced Selection Indicator */}
                {isSelected && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 font-medium">
                    <Check size={12} />
                    <span>Selected for calendar</span>
                  </div>
                )}

                {/* Step 13: Hover State Enhancement */}
                <div className={`mt-3 pt-2 border-t transition-all ${
                  isSelected 
                    ? 'border-blue-200' 
                    : 'border-gray-200'
                }`}>
                  <div className="text-xs text-gray-500">
                    Click to {isSelected ? 'remove from' : 'add to'} calendar
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 14: Enhanced Footer Information */}
      {!loading && notebooks.length > 0 && (
        <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
          Showing {filteredNotebooks.length} of {notebooks.length} available notebook{notebooks.length !== 1 ? 's' : ''}
          {selectedNotebooks.length > 0 && (
            <span className="ml-2 text-blue-600">
              • {selectedNotebooks.length} selected
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default NotebookSelector;