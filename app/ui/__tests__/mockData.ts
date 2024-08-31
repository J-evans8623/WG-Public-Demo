// bloom-maps/app/ui/__tests__/mockData.ts

import { ConceptNode } from '@/app/Definitions/Definitions';

export const mockNodes: ConceptNode[] = [
  {
    id: 'node-1',
    title: 'Node 1',
    cueCards: [
      { id: '1', title: 'Cue 1', content: 'Content of Cue 1' },
      { id: '2', title: 'Cue 2', content: 'Content of Cue 2' },
      { id: '3', title: 'Cue 3', content: 'Content of Cue 3' },
    ],
    parentNodeId: undefined,
    childrenNodeIds: [],
  },
  // Add more mock nodes if needed
];
