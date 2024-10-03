import React, { useState } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import ConceptNodeDisplay from './ConceptNodeDisplay';
import { Fab, Menu, MenuItem } from '@mui/material';
import { FaPencilAlt, FaEllipsisV, FaCut, FaPaste, FaTrashAlt, FaPlus } from 'react-icons/fa';
import ModernModal from '@/app/Library/components/ModernModal'; // Modal for Add and Edit
import CueCardEntry from './CueCardEntry'; 

const ConceptBank: React.FC = () => {
  const { state } = useDocumentContext(); // Fetch concept nodes from state
  const { nodes } = state; // Assuming nodes are stored in the state as a Map
  const { addCueCard, removeCueCard, editCueCard, transferCueCard, selectCueCards } = useCueCardContext();

  // State for managing cue card selection and cut
  const [selectedCueCardId, setSelectedCueCardId] = useState<string | null>(null);
  const [cutCueCardId, setCutCueCardId] = useState<string | null>(null);
  const [cutSourceNodeId, setCutSourceNodeId] = useState<string | null>(null); // Track the source node ID

  // State for FAB actions and Modal handling
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // For the FAB menu
  const [isModalOpen, setIsModalOpen] = useState(false); // State for Modal open/close
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add'); // Determine if Add or Edit action
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null); // Track selected node
  
  // Filter top-level nodes (nodes without a parent)
  const topLevelNodes = Array.from(nodes.values()).filter((node) => !node.parentNodeId);

  // Cue card selection handler
  const handleCueCardSelect = (cueCardId: string, nodeId: string) => {
    setSelectedCueCardId(cueCardId); // Update selected cue card
    setSelectedNodeId(nodeId); // Track the node where the cue card is selected
    setCutCueCardId(null); // Clear cut state if a new card is selected
    setCutSourceNodeId(null); // Clear source node when a new selection happens
  };

  // Node selection handler (to set where the paste operation should happen)
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId); // Update selected node for paste
  };

  // FAB menu handlers
  const handleFabClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  // Modal Handlers for Adding/Editing
  const handleOpenAddModal = () => {
    setModalMode('add');
    setIsModalOpen(true);
    handleCloseMenu();
  };

  const handleOpenEditModal = () => {
    if (selectedNodeId) {
      setModalMode('edit');
      setIsModalOpen(true);
    }
    handleCloseMenu();
  };

  const handleModalSave = (cueCardTitle: string, cueCardContent: string) => {
    if (modalMode === 'add' && selectedNodeId) {
      addCueCard(selectedNodeId, { id: Date.now().toString(), title: cueCardTitle, content: cueCardContent });
    } else if (modalMode === 'edit' && selectedNodeId) {
      editCueCard(selectedNodeId, { id: selectedNodeId, title: cueCardTitle, content: cueCardContent });
    }
    setIsModalOpen(false);
  };

  // Cue card cut handler
  const handleCueCardCut = (cueCardId: string, nodeId: string) => {
    setCutCueCardId(cueCardId); // Mark the cue card for cut
    setCutSourceNodeId(nodeId); // Store the node ID where the cue card was cut from
    setSelectedCueCardId(cueCardId); // Ensure the cut card is selected
  };

  // Cut, Paste, and Delete operations
  const handleCutCueCard = () => {
    if (selectedCueCardId && selectedNodeId) {
      handleCueCardCut(selectedCueCardId, selectedNodeId); // Capture cue card and its parent node ID
    }
    handleCloseMenu();
  };

  

  const handlePasteCueCard = () => {
    if (cutCueCardId && selectedNodeId && cutSourceNodeId) {
      transferCueCard(cutSourceNodeId, selectedNodeId, cutCueCardId); // Transfer from source node to target node
      setCutCueCardId(null); // Clear cut state after pasting
      setCutSourceNodeId(null); // Clear the source node after pasting
    }
    handleCloseMenu();
  };

  const handleDeleteCueCard = () => {
    if (selectedCueCardId && selectedNodeId) {
      removeCueCard(selectedNodeId, selectedCueCardId); // Remove the selected cue card
      setSelectedCueCardId(null); // Clear selection after deletion
    }
    handleCloseMenu();
  };

  return (
    <div style={{ width: '100%', padding: '10px', position: 'relative' }}>
      {/* Concept Bank Header */}
      <div className="flex justify-between items-center mb-4">
        <h2>Concept Bank</h2>

        {/* Floating Action Button (FAB) */}
        <div className="relative">
          <Fab
            size="small"
            color={selectedCueCardId ? "primary" : "default"} // Enable FAB when cue card is selected
            onClick={handleOpenEditModal}
            disabled={!selectedCueCardId} // Disable FAB when no cue card is selected
            title="Edit"
          >
            <FaPencilAlt />
          </Fab>

          <Fab
            size="small"
            color="secondary"
            onClick={handleFabClick}
            style={{ position: 'relative', marginLeft: '8px' }}
            title="Menu"
          >
            <FaEllipsisV />
          </Fab>

          {/* Menu for Add, Move, Cut, Paste, and Delete */}
          <Menu
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
            <MenuItem onClick={handleOpenAddModal}>Add</MenuItem>
            <MenuItem onClick={handleCutCueCard} disabled={!selectedCueCardId}>Cut</MenuItem> {/* Enable Cut based on cue card selection */}
            <MenuItem onClick={handlePasteCueCard} disabled={!cutCueCardId || !selectedNodeId}>Paste</MenuItem> {/* Enable Paste only when cut and node selected */}
            <MenuItem onClick={handleDeleteCueCard} disabled={!selectedCueCardId}>Delete</MenuItem>
          </Menu>
        </div>
      </div>

      {/* Display the top-level concept nodes */}
      {topLevelNodes.map((node) => (
        <ConceptNodeDisplay
          key={node.id}
          node={node}
          selectedCueCardId={selectedCueCardId}
          cutCueCardId={cutCueCardId}
          onCueCardSelect={handleCueCardSelect}
          onNodeSelect={handleNodeSelect} // Ensure node selection is handled
          onCueCardCut={handleCueCardCut}
        />
      ))}

      {/* Modal for adding or editing cue cards */}
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialNodeTitle={modalMode === 'edit' && selectedNodeId ? nodes.get(selectedNodeId)?.title || '' : 'New Cue Card'}
        mode={modalMode === 'add' ? 'addCueCard' : 'editCueCard'}
      />
    </div>
  );
};

export default ConceptBank;
