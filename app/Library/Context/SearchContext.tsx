// src/app/studygraph/(studygraph)/components/context/SearchContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useSearchResults } from '@/app/studygraph/(studygraph)/components/hooks/useSearchResults';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';

interface SearchContextType {
  isOpen: boolean;
  query: string;
  results: ResourceCard[];
  selectedResultIds: string[];      // ← Now an array
  open(): void;
  close(): void;
  setQuery(q: string): void;
  selectResult(id: string): void;    // ← Appends to the array
  clearSelection(): void;            // ← Clears the array
  removeSelectedResult(id: string): void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

interface SearchProviderProps {
  children: ReactNode;
}

/**
 * Provides global search state:
 *  - Modal open/close
 *  - Query string
 *  - Live filtered results
 *  - History of selected resource IDs
 */
export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);

  // Live, memoized filtering of all resources
  const results = useSearchResults(query);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  /** Append a new selection to history */
  const selectResult = (id: string) => {
    setSelectedResultIds(prev => [...prev, id]);
    close();
  };

  /** Clear the entire history of selections */
  const clearSelection = () => {
    setSelectedResultIds([]);
  };

  
   /** Remove a single selected result from history */
  const removeSelectedResult = (id: string) => {
    setSelectedResultIds(prev => prev.filter(x => x !== id));
  };

  return (
    <SearchContext.Provider value={{
      isOpen,
      query,
      results,
      selectedResultIds,
      open,
      close,
      setQuery,
      selectResult,
      clearSelection,
      removeSelectedResult
    }}>
      {children}
    </SearchContext.Provider>
  );
};

/** Hook for consuming the SearchContext */
export const useSearchContext = (): SearchContextType => {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return ctx;
};
