// src/app/workspace/(studygraph)/components/hooks/usePreorderTraversal.ts

import { useMemo } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';


/**
 * @file usePreorderTraversal.ts
 * @description
 *   Hook that returns an array of concept-node IDs in pre-order traversal
 *   (root → children left-to-right) of the current concept map.
 *
 * Responsibilities:
 *   - Fetch the global nodes map and root ID from NodesContext.
 *   - Perform a DFS pre-order traversal.
 *   - Recompute only when `nodes` or `getRootNode` changes.
 */
export function usePreorderTraversal(): string[] {
  const { nodes, getRootNode } = useNodesContext();

  const orderedNodeIds = useMemo(() => {
    const result: string[] = [];
    const visited = new Set<string>();

    function dfs(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      result.push(nodeId);
      const node = nodes.get(nodeId);
      if (!node || !node.childrenNodeIds) return;
      for (const childId of node.childrenNodeIds) {
        dfs(childId);
      }
    }

    const rootId = getRootNode();
    dfs(rootId);
    return result;
  }, [nodes, getRootNode]);

  return orderedNodeIds;
}
