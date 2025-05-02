/***************************************************************************************
 * @file TopicSelectorCombobox.tsx
 * @description
 *   This file defines a TopicSelectorCombobox component, which displays a custom
 *   dropdown for selecting a topic from a concept map. The design is based on the
 *   provided prototype and features:
 *     - A button to toggle the dropdown.
 *     - A separate search bar input to filter topics by name.
 *     - A scrollable list of topics with optional grouping by category (if desired).
 *     - Click-outside handling to close the dropdown.
 *
 *   Responsibilities:
 *     1) Provide a user-friendly, searchable list of topics.
 *     2) Manage state for the dropdown’s open/close status, the user’s search query,
 *        and the currently selected topic.
 *     3) Handle interactions such as outside clicks to close the dropdown and topic
 *        selection to update the parent component’s state.
 *
 * @author
 * @date
 ***************************************************************************************/

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

interface TopicSelectorComboboxProps {
  selectedTopicId: string;
  onSelectTopicId: (id: string) => void;
  label?: string;
}

/**
 * @function TopicSelectorCombobox
 * @description
 *   Renders a custom combobox for selecting a topic from the concept map. It includes
 *   a button to open/close the dropdown, a search bar for filtering topics, and a
 *   scrollable list of all matching topics. The user can select one topic at a time.
 *
 * Steps:
 *   1) Retrieve the concept map nodes from useNodesContext.
 *   2) Flatten them into a list of { id, title, [category?] } items.
 *   3) Manage local state for dropdown open/close, search term, and track clicks
 *      outside to close.
 *   4) Filter the node list by the user’s search input.
 *   5) Render a scrollable list of filtered topics, highlighting the selected topic.
 */
const TopicSelectorCombobox: React.FC<TopicSelectorComboboxProps> = ({
  selectedTopicId,
  onSelectTopicId,
  label = 'Select Topic'
}) => {
  // Dropdown open/close state
  const [isOpen, setIsOpen] = useState(false);
  // The user’s typed search term
  const [searchTerm, setSearchTerm] = useState('');
  // Reference to the entire combobox container (for outside clicks)
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Retrieve all nodes from the concept map
  const { nodes } = useNodesContext();
  const nodeArray = Array.from(nodes.values());

  /**
   * @function handleClickOutside
   * @description
   *   Closes the dropdown if the user clicks outside the combobox container.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * @constant filteredNodes
   * @description
   *   A list of nodes whose titles match the user’s search term.
   */
  const filteredNodes = nodeArray.filter((node) =>
    node.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find the user’s currently selected node title for the button label
  const currentSelection = nodeArray.find((node) => node.id === selectedTopicId);

  return (
    <div className="mb-6" ref={comboboxRef}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Button to toggle the dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-left"
        >
          {/* Display current selection or fallback text */}
          {currentSelection ? currentSelection.title : 'Select topic...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 border border-gray-300 rounded-md bg-white shadow-lg">
            {/* Separate search bar */}
            <input
              type="text"
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border-b border-gray-300 outline-none"
            />

            {/* Scrollable list of topics */}
            <div className="max-h-60 overflow-auto">
              {/* If no nodes match, show a message */}
              {filteredNodes.length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-center">
                  No topics found
                </div>
              )}
              {/* Otherwise, list all matching nodes */}
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center ${
                    selectedTopicId === node.id ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => {
                    onSelectTopicId(node.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {selectedTopicId === node.id && (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {node.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicSelectorCombobox;
