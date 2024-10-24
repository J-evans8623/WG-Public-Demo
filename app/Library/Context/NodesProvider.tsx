import React, { createContext, useReducer, useContext, useMemo, ReactNode } from 'react';
import { nodesReducer, initialNodesState } from './nodesReducer';
import { ConceptNode, NodesAction } from '@/app/Library/Definitions/Definitions';

interface NodesContextValue {
  nodes: Map<string, ConceptNode>;
  dispatch: React.Dispatch<NodesAction>;
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  const [nodes, dispatch] = useReducer(nodesReducer, initialNodesState);
  const contextValue = useMemo(() => ({ nodes, dispatch }), [nodes]);

  return (
    <NodesContext.Provider value={contextValue}>
      {children}
    </NodesContext.Provider>
  );
};

export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};
