import React from 'react';
import { Map } from 'lucide-react';
import { navItems, ViewType } from './NavItems';

interface SidebarProps {
  isDashboardExpanded: boolean;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isDashboardExpanded,
  currentView,
  onViewChange,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <div
      style={{ width: isDashboardExpanded ? '12rem' : '3rem' }}
      className="fixed left-0 top-0 h-full bg-gray-800 transition-all duration-300 z-50"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center p-4 border-b border-gray-700">
        <Map className="h-8 w-8 text-orange-500 flex-shrink-0" />
        {isDashboardExpanded && (
          <span className="ml-3 text-white font-semibold">BloomMap</span>
        )}
      </div>

      <nav className="mt-6 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white ${
              item.view === currentView ? 'bg-gray-700 text-white' : ''
            }`}
            onClick={() => item.view && onViewChange(item.view)}
          >
            <item.icon className="h-5 w-5" />
            {isDashboardExpanded && (
              <span className="ml-4">{item.label}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};
