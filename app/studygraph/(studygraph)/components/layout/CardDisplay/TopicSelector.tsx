// TopicSelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';

const TopicSelector: React.FC = () => {
  // Start collapsed by default
  const [expanded, setExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Retrieve the lesson module info to show the lesson title when expanded
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(
    (conceptMap) => conceptMap.id === activeConceptMapId
  );
  const lessonTitle = activeLesson ? activeLesson.title : 'Untitled Lesson';

  // Get nodes and selection logic from context
  const { nodes } = useNodesContext();
  const { getSelectedNodeIds, isSelected, multiSelect, deselectNode } = useNodeSelection();

  // Convert nodes map to an array
  const nodeArray = Array.from(nodes.values()).map(n => ({
    id: n.id,
    title: n.title,
  }));

  // Get the list of currently selected node IDs
  const selectedIds = getSelectedNodeIds();

  // Click-outside handler: collapse if click is outside the component
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expanded && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  return (
    <div ref={containerRef} className="flex flex-col w-full max-w-md p-2 map-right-pane text-sm">
      {/* Header: clickable to expand/collapse */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="font-medium text-slate-800">Selected Topics</div>
        <div className="text-xs text-slate-500">
          {selectedIds.length === 0 ? '' : `(${selectedIds.length})`}
        </div>
        <button className="text-slate-500">
          {expanded ? (
            // Up chevron
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          ) : (
            // Down chevron
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* When expanded, show the currently selected lesson title */}
      {expanded && (
        <>
          <div className="px-4 py-1 text-xs text-slate-600">
            {lessonTitle}
          </div>
          <div className="border-t border-slate-200 mx-2"></div>
        </>
      )}

      {/* Scrollable checkbox list with custom scrollbar */}
      {expanded && (
        <div className="p-2 overflow-y-auto max-h-24 custom-scrollbar">
          {nodeArray.length === 0 ? (
            <div className="text-sm text-slate-500 px-2 py-2">
              No topics available.
            </div>
          ) : (
            nodeArray.map(node => {
              const checked = isSelected(node.id);
              return (
                <label
                  key={node.id}
                  className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    checked={checked}
                    onChange={e => {
                      if (e.target.checked) {
                        multiSelect(node.id, true);
                      } else {
                        deselectNode(node.id);
                      }
                    }}
                  />
                  <span className="ml-2 text-xs text-slate-800">
                    {node.title}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default TopicSelector;
