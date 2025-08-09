import React from 'react';
import { Search } from 'lucide-react';

export interface SearchButtonProps {
  /**
   * Step 1: Called when the user clicks the SearchButton.
   * Step 2: Expected to open the notes search modal via useSearchContext.open().
   */
  onClick: () => void;
}

/**
 * SearchButton
 *
 * Renders an icon-based button using a magnifying glass glyph for triggering
 * the notes search modal. This function logs each click event for observability,
 * ensures correct aria labeling for accessibility, and delegates the actual
 * search-opening behavior through the onClick callback, abiding by single
 * responsibility and decoupling the UI from business logic.
 *
 * @param onClick The callback to execute when the button is clicked.
 */
const SearchButton: React.FC<SearchButtonProps> = ({ onClick }) => {
  return (
    <button
      className="search-button flex items-center gap-1.5 border border-blue-400 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-all duration-200 text-sm font-normal hover:border-blue-500"
      aria-label="Search notes"
      onClick={() => {
        console.log('[SearchButton.tsx][6002] › SearchButton clicked');
        onClick();
      }}
    >
      <Search size={16} />
      Search
    </button>
  );
};

export default SearchButton;