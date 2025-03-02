/**
 * @file UnifiedHeader.tsx
 * @description
 *   This component renders the unified header used in the right panel of the application.
 *   It displays a tab selector for 'Notes' and 'Chat', and contextual actions based on the active canvas view
 *   and the active card display tab.
 *
 *   When both the upload canvas view (i.e. 'pdf') and the notes tab are active, the header displays a "Topics"
 *   dropdown menu (with the original styling and downward arrow cue). The dropdown menu supports multi‐select
 *   checkboxes for selecting multiple topics from the concept map (replicating the old TopicSelector functionality).
 *
 *   Otherwise, if the notes tab is active but the canvas is not in upload mode, the default Add Resource
 *   and Font Size buttons are shown. For the chat tab, no contextual actions are rendered.
 *
 *   Responsibilities:
 *     - Render tabs for switching between notes and chat.
 *     - Conditionally render contextual actions based on both the active canvas view and card display tab.
 *     - Provide a topics dropdown menu with multi‐select checkboxes for selecting topics.
 *
 *   Updates:
 *     - Restored the original button styling for the Topics dropdown (with arrow icon).
 *     - Implemented multi‐select checkbox logic to replicate TopicSelector functionality.
 *     - Conditionally renders this Topics dropdown only when the notes tab and the upload tab are both active.
 *
 * @author 
 * @date   
 */

import React, { useEffect, useRef, useState } from 'react';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import AddResourceDropdown from './buttons/AddResourceDropdown';
import FontSizeButton from './buttons/FontSizeButton';
import { ResourceType } from './buttons/AddResourceDropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';

interface UnifiedHeaderProps {
  activeTab: 'notes' | 'chat';
  onTabChange: (tab: 'notes' | 'chat') => void;
  width: number;
  onAddResource: (type: ResourceType) => void;
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
}

/**
 * TopicsDropdown Component
 * @description
 *   Renders a dropdown menu for selecting topics from the concept map. The button
 *   retains the original styling and arrow icon. The dropdown uses checkboxes to
 *   allow multi‐select, mirroring the old TopicSelector functionality.
 *
 *   The NodeSelectionContext is used to manage which topics (nodes) are selected.
 *   Each checkbox toggles a node in or out of the selection. The total number of
 *   selected topics is not displayed on the button label by default (as per original
 *   styling), but you can adapt if needed.
 *
 * @param selectedTopic - Currently selected topic label (unused in multi‐select, but preserved for props consistency).
 * @param onTopicChange - Callback function for changing the topic (unused in multi‐select, but preserved for props consistency).
 */
const TopicsDropdown: React.FC<{
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
}> = ({ selectedTopic, onTopicChange }) => {
  // State to manage dropdown open/close
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // Ref for detecting clicks outside the dropdown
  const containerRef = useRef<HTMLDivElement>(null);

  // Retrieve the lesson info for display
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(
    (conceptMap) => conceptMap.id === activeConceptMapId
  );
  const lessonTitle = activeLesson ? activeLesson.title : 'Untitled Lesson';

  // Get node data and selection logic
  const { nodes } = useNodesContext();
  const { getSelectedNodeIds, isSelected, multiSelect, deselectNode } = useNodeSelection();

  // Convert nodes to an array
  const nodeArray = Array.from(nodes.values()).map((n) => ({
    id: n.id,
    title: n.title,
  }));

  // Handle toggling the dropdown open/close
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Click‐outside handler: collapse dropdown if user clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Original styled button with arrow icon */}
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-1 px-4 py-1.5 rounded-md bg-[var(--left-pane-bg)] hover:bg-[var(--bg-selected)]"
      >
        <span>Topics</span>
        {/* Downward arrow icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-10">
          {/* Lesson title (optional, but included for clarity) */}
          <div className="px-4 py-1 text-xs text-slate-600">{lessonTitle}</div>
          <div className="border-t border-slate-200 mx-2"></div>

          <div className="p-2 overflow-y-auto max-h-24 custom-scrollbar">
            {nodeArray.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">No topics available.</div>
            ) : (
              nodeArray.map((node) => {
                const checked = isSelected(node.id);
                return (
                  <label
                    key={node.id}
                    className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          multiSelect(node.id, true);
                        } else {
                          deselectNode(node.id);
                        }
                      }}
                    />
                    <span className="ml-2 text-xs text-slate-800">{node.title}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * UnifiedHeader Component
 * @description
 *   Renders the header component that includes tab selection and contextual actions.
 *   The contextual actions vary based on the active canvas view and the active card display tab:
 *     - When the notes tab is active AND the canvas is in upload mode (pdf view), displays the multi‐select Topics dropdown.
 *     - When the notes tab is active and the canvas is not in upload mode, displays the Add Resource dropdown and Font Size button.
 *     - When the chat tab is active, no contextual actions are rendered.
 *
 * @param props - UnifiedHeaderProps containing state and callback functions.
 */
const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  activeTab,
  onTabChange,
  width,
  onAddResource,
  selectedTopic,
  onTopicChange,
}) => {
  // Retrieve the active canvas view from the ViewSwitchContext
  const { activeView } = useViewSwitch();

  return (
    <div className="map-left-pane px-4 py-2 border-b map-divider flex justify-between items-center">
      {/* Tab Selector */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as 'notes' | 'chat')}
      >
        <TabsList className="bg-transparent gap-1">
          <TabsTrigger
            value="notes"
            className="
              px-4 py-1.5
              rounded-md
              bg-[var(--left-pane-bg)]
              hover:bg-[var(--bg-selected)]
              data-[state=active]:bg-[var(--bg-selected)]
              data-[state=active]:shadow-sm
            "
          >
            Notes
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="
              px-4 py-1.5
              rounded-md
              bg-[var(--left-pane-bg)]
              hover:bg-[var(--bg-selected)]
              data-[state=active]:bg-[var(--bg-selected)]
              data-[state=active]:shadow-sm
            "
          >
            Chat
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Contextual Actions */}
      <div className="flex items-center gap-2">
        {activeTab === 'notes' ? (
          activeView === 'pdf' ? (
            // When both the upload mode is active and the notes tab is selected, show the Topics dropdown.
            <TopicsDropdown selectedTopic={selectedTopic} onTopicChange={onTopicChange} />
          ) : (
            // When in notes tab but not in upload mode, show the default Add Resource dropdown and Font Size button.
            <>
              <AddResourceDropdown onSelectType={onAddResource} />
              <FontSizeButton />
            </>
          )
        ) : null /* For the chat tab, no contextual actions are rendered */}
      </div>
    </div>
  );
};

export default UnifiedHeader;
