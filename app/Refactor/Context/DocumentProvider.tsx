import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CueCard, ConceptNode, DocumentContextType, ColorTheme } from '@/app/Refactor/Definitions/Definitions';



// Create the context with an undefined initial value
const baseZoomLevel = 0.7;
const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

 const DocumentProvider = ({ children }: { children: ReactNode }) => {

    // Node Data
    const [nodes, setNodes] = useState<Map<string, ConceptNode>>(new Map());
    const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]);
    


     // State to manage color theme
    const [colorTheme, setColorTheme] = useState<ColorTheme>('cool-spring'); // Default color theme


    // Tree Settings
    const [getLayout, setGetLayout] = useState<boolean>(false); // HV Lay-out flag


    // General Settigns
      // State to manage bloom depth
    const [bloomDepth, setBloomDepth] = useState<1 | 2 | 3 | 4 | 5 | 6>(6); // Default bloom depth
    const [defaultMapWidth, setDefaultMapWidth] = useState<number>(1800); // Default width
    const [defaultMapHeight, setDefaultMapHeight] = useState<number>(1800); // Default height
    const [scrollLeft, setScrollLeft] = useState<number>(0); //  define the state for horizontal scroll
    const [scrollTop, setScrollTop] = useState<number>(0); //  define the state for vertical scroll
 
      // State to manage the "ground" width
  const [groundWidth, setGroundWidth] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(baseZoomLevel); // Default zoom level is 100%

  const getDisplayedZoomLevel = () => {
    // Convert actual zoom level to displayed zoom level
    return (zoomLevel / baseZoomLevel) * 100;
  };

  const updateScrollPosition = (left: number, top: number) => {
    setScrollLeft(left);
    setScrollTop(top);
  };
  const adjustScrollPosition = (newZoomLevel: number) => {
    setScrollLeft((prevScrollLeft: number) => (prevScrollLeft * newZoomLevel) / zoomLevel);
    setScrollTop((prevScrollTop: number) => (prevScrollTop * newZoomLevel) / zoomLevel);
  };
  const zoomIn = () => {
    setZoomLevel((prevZoom: number) => {
      const newZoom = Math.min(prevZoom + 0.1 * baseZoomLevel, 2 * baseZoomLevel); // Max zoom level 200% relative to base
      adjustScrollPosition(newZoom);
      return newZoom;
    });
  };
  
  const zoomOut = () => {
    setZoomLevel((prevZoom: number) => {
      const newZoom = Math.max(prevZoom - 0.1 * baseZoomLevel, 0.1 * baseZoomLevel); // Min zoom level 10% relative to base
      adjustScrollPosition(newZoom);
      return newZoom;
    });
  };
  

    //Allowed Array Datastructures
      // Function to select cue cards
    // State to manage selected cue cards


    //Document Creation
    const primaryRootNode = (title: string, mapWidth: number) => {
      const newRootNode: ConceptNode = {
        id: 'node-1',
        title: title || 'Root Concept',
        cueCards: [],
        parentNodeId: undefined,
        childrenNodeIds: [],
        x: mapWidth / 2, // Centered horizontally based on client width
        y: 200, // Initial y-position for the root node
        isRoot: true,
      };
    
      setNodes(() => {
        const updatedNodes = new Map<string, ConceptNode>(); // Create a new Map
        updatedNodes.set(newRootNode.id, newRootNode); // Add the new root node to the Map
    
        return updatedNodes; // Return the updated Map
      });
    
      setGetLayout(true); // Set layout flag to true
    };


    const initializeNewDocument = (
      bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
      groundWidth: number,
      isInitialLoad: boolean,
      mapWidth: number = defaultMapWidth,
      mapHeight: number = defaultMapHeight
    ) => {
      // If it's not the initial load, reset global data
      if (!isInitialLoad) {
        setNodes(new Map());
        setSelectedCueCards([]);
        setZoomLevel(0.7); // Reset zoom level to default
      }
    
      // Reset map size to default
      setGroundWidth(groundWidth);// revisit
      setDefaultMapWidth(mapWidth);
      setDefaultMapHeight(mapHeight);
    
      // Create the primary root node
      const newRootNode: ConceptNode = {
        id: 'node-1',
        title: 'Root Concept',
        cueCards: [],
        parentNodeId: undefined,
        childrenNodeIds: [],
        x: (mapWidth / 2) - 100, // 0.5 * node width = 100
        y: 200, // Position at the top
        isRoot: true,
      };
    
      // Initialize a new Map with the new root node
      setNodes(() => {
        const updatedNodes = new Map<string, ConceptNode>();
        updatedNodes.set(newRootNode.id, newRootNode); // Add the root node to the Map
    
        return updatedNodes; // Return the new Map
      });
    
      setBloomDepth(bloomDepth); // Set the new bloom depth
      setGetLayout(true); // Set layout flag to true
    };
    
    
    const createSecondaryRootNode = (title: string, x: number, y: number) => {
      const newNodeId = `node-${nodes.size + 1}`; // Use size property to get the count of nodes
    
      const newRootNode: ConceptNode = {
        id: newNodeId,
        title: title || `New Root Concept ${nodes.size + 1}`, // Use size to determine node number
        cueCards: [],
        parentNodeId: undefined, // No parent for a root node
        childrenNodeIds: [],
        x,
        y,
      };
    
      // Update the state with the new node
      setNodes((prevNodes) => {
        const updatedNodes = new Map(prevNodes); // Create a new Map from the previous state
        updatedNodes.set(newNodeId, newRootNode); // Add the new root node to the Map
        return updatedNodes; // Return the updated Map
      });
    
      setGetLayout(true); // Set layout flag to true
    };
    
    
    // Utility 
    const selectCueCards = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards);
  };

    //Map Datastructure
    const createNewNode = (title: string, parentNodeId: string) => {
      const newNodeId = `node-${nodes.size + 1}`; // Use nodes.size to get the current number of nodes
    
      // Ensure that parentNodeId is defined for all nodes except the root
      const parentNode = nodes.get(parentNodeId); // Use Map's get method to find the parent node
      if (!parentNode) {
        console.error(`Parent node with ID ${parentNodeId} not found.`);
        return;
      }
    
      // Calculate the position for the new child node relative to its parent
      const x = parentNode.x + 250; // Example offset, adjust as needed
      const y = parentNode.y + 150; // Example offset, adjust as needed
    
      const newNode: ConceptNode = {
        id: newNodeId,
        title: title || `Untitled Concept ${nodes.size + 1}`,
        cueCards: [],
        parentNodeId: parentNodeId,
        childrenNodeIds: [],
        x,
        y,
        isRoot: false,
      };
    
      // Add the new node to the state using Map
      setNodes((prevNodes) => {
        const updatedNodes = new Map(prevNodes); // Create a new Map from the previous state
        updatedNodes.set(newNode.id, newNode); // Add the new node using its ID as the key
    
        // Update parent's childrenNodeIds
        const updatedChildrenNodeIds = [...(parentNode.childrenNodeIds || []), newNodeId];
        const updatedParentNode = { ...parentNode, childrenNodeIds: updatedChildrenNodeIds };
        updatedNodes.set(parentNodeId, updatedParentNode); // Update the parent node in the Map
    
        return updatedNodes; // Return the updated Map
      });
    };

    // Function to update a node by ID
const updateNode = (nodeId: string, updatedNode: Partial<ConceptNode>) => {
  setNodes((prevNodes) => {
    const updatedNodes = new Map(prevNodes); // Create a shallow copy of the previous Map
    const nodeToUpdate = updatedNodes.get(nodeId); // Retrieve the node by its ID

    if (nodeToUpdate) {
      // If the node exists, update its properties
      const mergedNode = { ...nodeToUpdate, ...updatedNode };
      updatedNodes.set(nodeId, mergedNode); // Update the Map with the merged node
    } else {
      console.error(`Node with ID ${nodeId} not found.`);
    }

    return updatedNodes; // Return the updated Map
  });
};

    // Function to add a cue card to a specific node
const addCueCardToNode = (nodeId: string, cueCard: CueCard) => {
    setNodes((prevNodes) => {
      const updatedNodes = new Map(prevNodes); // Create a new Map from the previous state
      const nodeToUpdate = updatedNodes.get(nodeId); // Get the node to update by its ID
  
      if (!nodeToUpdate) {
        console.error(`Node with ID ${nodeId} not found.`);
        return updatedNodes; // Return the previous state if node is not found
      }
  
      // Create an updated node object with the new cue card added
      const updatedNode: ConceptNode = {
        ...nodeToUpdate,
        cueCards: [...nodeToUpdate.cueCards, cueCard], // Add the new cue card to the existing array
      };
  
      updatedNodes.set(nodeId, updatedNode); // Set the updated node in the Map
  
      return updatedNodes; // Return the updated Map
    });
  };
  // Function to update the title of a specific node
const updateNodeTitle = (nodeId: string, newTitle: string) => {
    setNodes((prevNodes) => {
      const updatedNodes = new Map(prevNodes); // Create a new Map from the previous state
      const nodeToUpdate = updatedNodes.get(nodeId); // Get the node to update by its ID
  
      if (!nodeToUpdate) {
        console.error(`Node with ID ${nodeId} not found.`);
        return updatedNodes; // Return the previous state if the node is not found
      }
  
      // Create an updated node object with the new title
      const updatedNode: ConceptNode = {
        ...nodeToUpdate,
        title: newTitle, // Update the title
      };
  
      updatedNodes.set(nodeId, updatedNode); // Set the updated node in the Map
  
      return updatedNodes; // Return the updated Map
    });
  };
  
  return (
    <DocumentContext.Provider
      value={{
        nodes,
        updateNode,
        selectCueCards,
        bloomDepth,
        setBloomDepth,
        colorTheme,
        setColorTheme,
        selectedCueCards,        
        addCueCardToNode,
        updateNodeTitle,
        getLayout,
        setGetLayout,
        createNewNode,
        primaryRootNode,
        zoomLevel,
        defaultMapWidth,
        defaultMapHeight,
        initializeNewDocument,
        createSecondaryRootNode,
        zoomIn,
        zoomOut,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

// Custom hook to use the DocumentContext
export const useDocumentContext = () => {
    const context = useContext(DocumentContext);
    if (context === undefined) {
      throw new Error('useDocumentContext must be used within a DocumentProvider');
    }
    return context;
  };
  
// Export DocumentProvider as the default export
export default DocumentProvider;