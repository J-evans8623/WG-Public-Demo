// bloom-maps\app\Library\Context\documentReducer.ts
import { ConceptNode, CueCard, DocumentState, DocumentAction, DocumentActionType } from '@/app/Library/Definitions/Definitions';

const baseZoomLvl = 0.7;//0.7
// Define the initial state for the document
export const initialDocumentState: DocumentState = {
    nodes: new Map<string, ConceptNode>(),
    selectedCueCards: [],// Revisit
    bloomDepth: 6, // Default bloom depth
    colorTheme: 'cool-spring', // Default color theme
    getLayout: false,
    zoomLevel: baseZoomLvl, // Default zoom level
    baseZoomLevel: baseZoomLvl,
    defaultMapWidth: 1800, // Default map width
    defaultMapHeight: 1800, // Default map height
    groundWidth: 0, // Initial ground width ???
    resetMapSize: false, // Test
    scrollLeft: 0, // Initial scroll position on the x-axis
  scrollTop: 0, // Initial scroll position on the y-axis
  primaryColor: '#D5E6ED', // Default primary color
  backgroundColor: '#ECE7D1',

  };


// Define the reducer function
export const documentReducer = (state: DocumentState, action: DocumentAction): DocumentState => {
    if (!action || !action.type) {
      console.error('Invalid action dispatched:', action);
      return state;
    }
  
    switch (action.type) {
      /**case DocumentActionType.SELECT_CUE_CARDS:
        return { ...state, selectedCueCards: action.payload }; */
      case DocumentActionType.SET_NODES:
        return { ...state, nodes: action.payload };
      case DocumentActionType.SET_COLOR_THEME:
        return { ...state, colorTheme: action.payload };
      
        case DocumentActionType.SET_PRIMARY_COLOR:
            return { ...state, primaryColor: action.payload };
      
          case DocumentActionType.SET_BACKGROUND_COLOR:
            return { ...state, backgroundColor: action.payload };
        case DocumentActionType.UPDATE_NODE_TITLE:
        const { nodeId: titleNodeId, newTitle } = action.payload;
        const nodesWithUpdatedTitle = new Map(state.nodes);
        const nodeToUpdate = nodesWithUpdatedTitle.get(titleNodeId);
        if (nodeToUpdate) {
          nodeToUpdate.title = newTitle;
          nodesWithUpdatedTitle.set(titleNodeId, nodeToUpdate);
        }
        return { ...state, nodes: nodesWithUpdatedTitle };
      case DocumentActionType.SET_GET_LAYOUT:
        return { ...state, getLayout: action.payload };

       /**  case DocumentActionType.CREATE_NEW_NODE: {
            const { title, parentNodeId } = action.payload;
          
            // Validate that parentNode exists
            const parentNode = state.nodes.get(parentNodeId);
            if (!parentNode) {
              console.error(`Parent node with ID ${parentNodeId} not found.`);
              return state; // Return unchanged state if parent not found
            }
          
            // Determine the new node ID and depth
            const newNodeId = `node-${state.nodes.size + 1}`;
            const newDepth = (parentNode.depth || 0) + 1;
          
            // Create new node safely
            const newNode: ConceptNode = {
              id: newNodeId,
              title: title || `Untitled Concept ${state.nodes.size + 1}`,
              //cueCards: [],
              parentNodeId: parentNodeId,
              childrenNodeIds: [],
              x: undefined,
              y: undefined,
              isRoot: false,
              depth: newDepth,
            };
          
            // Create a new map of nodes to update the state
            const updatedNodes = new Map(state.nodes);
          
            // Ensure parentNode is updated correctly with children
            const updatedParentNode = {
              ...parentNode,
              childrenNodeIds: [...(parentNode.childrenNodeIds || []), newNodeId],
            };
          
            // Add the new node and the updated parent node to the nodes map
            updatedNodes.set(parentNodeId, updatedParentNode);
            updatedNodes.set(newNode.id, newNode);
          
            return {
              ...state,
              nodes: updatedNodes,
            };
          }*/
            case DocumentActionType.CREATE_NEW_NODE: {
              const { title, parentNodeId } = action.payload;
              const parentNode = state.nodes.get(parentNodeId);
              if (!parentNode) {
                console.error(`Parent node with ID ${parentNodeId} not found.`);
                return state;
              }
        
              const newNodeId = `node-${state.nodes.size + 1}`;
              const newDepth = (parentNode.depth || 0) + 1;
        
              const newNode: ConceptNode = {
                id: newNodeId,
                title: title || `Untitled Concept ${state.nodes.size + 1}`,
                parentNodeId: parentNodeId,
                childrenNodeIds: [],
                x: undefined,
                y: undefined,
                isRoot: false,
                depth: newDepth,
                subtreeID: parentNode.subtreeID || parentNodeId, // Assign subtreeID
              };
        
              const updatedNodes = new Map(state.nodes);
              const updatedParentNode = {
                ...parentNode,
                childrenNodeIds: [...(parentNode.childrenNodeIds || []), newNodeId],
              };
        
              updatedNodes.set(parentNodeId, updatedParentNode);
              updatedNodes.set(newNode.id, newNode);
        
              return {
                ...state,
                nodes: updatedNodes,
                getLayout: true, // Trigger layout computation
              };
            }
        
          case DocumentActionType.RESET_GLOBAL_DATA:
            return {
              ...state,
              nodes: new Map<string, ConceptNode>(), // Reset nodes
              selectedCueCards: [], // Reset selected cue cards
              zoomLevel: baseZoomLvl, // Reset zoom level 0.7
            };
        case DocumentActionType.SET_MAP_SIZE:
      return {
        ...state,
        groundWidth: action.payload.groundWidth,
        defaultMapWidth: action.payload.mapWidth,
        defaultMapHeight: action.payload.mapHeight,
      };

      case DocumentActionType.TOGGLE_RESET_MAP_SIZE:
      return {
        ...state,
        resetMapSize: !state.resetMapSize, // Toggle the resetMapSize flag
      };

      case DocumentActionType.INIT_NEW_DOCUMENT:
        const newRootNode: ConceptNode = {
          id: 'node-1',
          title: 'Root Concept',
          //cueCards: [],
          parentNodeId: undefined,
          childrenNodeIds: [],
          x: 0, // initially 0 root debug
          y: 0,//200,
          isRoot: true,
          depth: 0,
        };
        
  
        const newNodes = new Map<string, ConceptNode>();
        newNodes.set(newRootNode.id, newRootNode);
  
        return {
          ...state,
          nodes: newNodes,
          bloomDepth: action.payload.bloomDepth,
          getLayout: true,
        };

        case DocumentActionType.ZOOM_IN: {
            const newZoom = Math.min(state.zoomLevel + 0.1 * baseZoomLvl, 2 * baseZoomLvl);
            
            // Adjust scroll positions to maintain the center
            const adjustedScrollLeft = state.scrollLeft * (newZoom / state.zoomLevel);
            const adjustedScrollTop = state.scrollTop * (newZoom / state.zoomLevel);
            
            return { 
                ...state, 
                zoomLevel: newZoom,
                scrollLeft: adjustedScrollLeft,
                scrollTop: adjustedScrollTop,
            };
        }
      
        case DocumentActionType.ZOOM_OUT: {
            const newZoom = Math.max(state.zoomLevel - 0.1 * baseZoomLvl, 0.1 * baseZoomLvl);
            
            // Adjust scroll positions to maintain the center
            const adjustedScrollLeft = state.scrollLeft * (newZoom / state.zoomLevel);
            const adjustedScrollTop = state.scrollTop * (newZoom / state.zoomLevel);
            
            return { 
                ...state, 
                zoomLevel: newZoom,
                scrollLeft: adjustedScrollLeft,
                scrollTop: adjustedScrollTop,
            };
        }
          case DocumentActionType.UPDATE_NODE: {
            const { nodeId, updatedNode } = action.payload;
            const nodesWithUpdatedNode = new Map(state.nodes);
            const nodeToUpdate = nodesWithUpdatedNode.get(nodeId);
          
            if (nodeToUpdate) {
              // Merge the existing node properties with the updated properties
              const mergedNode = { ...nodeToUpdate, ...updatedNode };
              nodesWithUpdatedNode.set(nodeId, mergedNode); // Update the Map with the merged node
            } else {
              console.error(`Node with ID ${nodeId} not found.`);
            }
          
            return { ...state, nodes: nodesWithUpdatedNode };
          }
          

    
      default:
        console.warn(`Unhandled action type: ${action.type}`);
        return state;
    }

  };