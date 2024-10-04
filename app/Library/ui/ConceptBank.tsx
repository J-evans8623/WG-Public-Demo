// bloom-maps/app/Library/components/ConceptBank.tsx

import React, { useState } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import ConceptNodeDisplay from './ConceptNodeDisplay';
import { Fab } from '@mui/material';
import ModernModal from '@/app/Library/Tests/ModernModal'; // Modal for Add and Edit
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';



const ConceptBank: React.FC = () => {
  const { state } = useDocumentContext(); // Fetch concept nodes from state
  const { nodes } = state; // Assuming nodes are stored in the state as a Map
  const {removeCueCard, editCueCard, transferCueCard, selectCueCards } = useCueCardContext();

  // State for managing cue card selection and cut
  const [selectedCueCardId, setSelectedCueCardId] = useState<string | null>(null);
  const [cutCueCardId, setCutCueCardId] = useState<string | null>(null);
  const [cutSourceNodeId, setCutSourceNodeId] = useState<string | null>(null); // Track the source node ID

  // State for FAB actions and Modal handling
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // For the FAB menu
  const [isModalOpen, setIsModalOpen] = useState(false); // State for Modal open/close
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add'); // Determine if Add or Edit action
  const [initialCueCardData, setInitialCueCardData] = useState<{
    title: string;
    content: string;
    bloomLevel: 1 | 2 | 3 | 4 | 5 | 6;
    source: string;
  } | null>(null);

  // State to hold selected node for paste
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


  const handleOpenEditModal = () => {
    if (selectedCueCardId && selectedNodeId) {
      // Fetch the selected cue card's data
      const selectedNodeCueCards = selectCueCards(selectedNodeId);
      const selectedCueCard = selectedNodeCueCards.find(card => card.id === selectedCueCardId);
      
      if (selectedCueCard) {
        setModalMode('edit');
        setInitialCueCardData({
          title: selectedCueCard.title,
          content: selectedCueCard.content,
          bloomLevel:  selectedCueCard.bloomLevel ?? 1,
          source: selectedCueCard.source || '',
        });
        setIsModalOpen(true);
      }
    }
    handleCloseMenu();
  };

  const handleModalSave = (
    nodeTitle: string,
    cueCardTitle: string,
    cueCardContent: string,
    bloomLevel: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string
  ) => {
    if (modalMode === 'edit' && selectedCueCardId && selectedNodeId && initialCueCardData) {
      // Correctly set the id to selectedCueCardId for editing
      editCueCard(selectedNodeId, { id: selectedCueCardId, title: cueCardTitle, content: cueCardContent, bloomLevel, source });
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
  const handleCutCueCardAction = () => {
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
    <div style={{ width: '100%', padding: '20px', position: 'relative' }}>
      {/* FAB Buttons Container - Positioned Sticky at Top */}
      <div
        className="flex justify-center items-center mb-4"
        style={{
          position: 'sticky',
          top: 2,
          background: 'white',
          padding: '10px 0',
          zIndex: 10,
        }}
      >
        {/* Cut Button */}
        <Fab
          size="small"
          sx={{
            backgroundColor: 'white',
            '&:hover': { backgroundColor: '#D3E3FD' },
            '&:disabled': { backgroundColor: '#f5f5f5' },
            boxShadow: 'none',
          }}
          onClick={handleCutCueCardAction}
          disabled={!selectedCueCardId}
          title="Cut"
          style={{ marginRight: '8px' }}
        >
          <ContentCutOutlinedIcon />
        </Fab>
  
        {/* Paste Button */}
        <Fab
          size="small"
          sx={{
            backgroundColor: 'white',
            '&:hover': { backgroundColor: '#D3E3FD' },
            '&:disabled': { backgroundColor: '#f5f5f5' },
            boxShadow: 'none',
          }}
          onClick={handlePasteCueCard}
          disabled={!cutCueCardId || !selectedNodeId || !cutSourceNodeId}
          title="Paste"
          style={{ marginRight: '8px' }}
        >
          <ContentPasteIcon />
        </Fab>
  
        {/* Edit Button */}
        <Fab
          size="small"
          sx={{
            backgroundColor: selectedCueCardId ? 'white' : '#f5f5f5',
            '&:hover': { backgroundColor: selectedCueCardId ? '#D3E3FD' : '#f5f5f5' },
            boxShadow: 'none',
          }}
          onClick={handleOpenEditModal}
          disabled={!selectedCueCardId}
          title="Edit"
          style={{ marginRight: '8px' }}
        >
          <EditIcon />
        </Fab>
  
        {/* Delete Button */}
        <Fab
          size="small"
          sx={{
            backgroundColor: 'white',
            '&:hover': { backgroundColor: '#D3E3FD' },
            '&:disabled': { backgroundColor: '#f5f5f5' },
            boxShadow: 'none',
          }}
          onClick={handleDeleteCueCard}
          disabled={!selectedCueCardId}
          title="Delete"
        >
          <DeleteIcon />
        </Fab>
      </div>
  
      {/* Display the top-level concept nodes */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
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
      </div>
  
      {/* Modal for adding or editing cue cards */}
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialNodeTitle={modalMode === 'edit' && selectedNodeId ? nodes.get(selectedNodeId)?.title || '' : 'New Cue Card'}
        mode={modalMode === 'add' ? 'addCueCard' : 'editCueCard'}
        initialCueCardTitle={modalMode === 'edit' && initialCueCardData ? initialCueCardData.title : undefined}
        initialCueCardContent={modalMode === 'edit' && initialCueCardData ? initialCueCardData.content : undefined}
        initialBloomLevel={modalMode === 'edit' && initialCueCardData ? initialCueCardData.bloomLevel : undefined}
        initialSource={modalMode === 'edit' && initialCueCardData ? initialCueCardData.source : undefined}
      />
    </div>
  );
  
};

export default ConceptBank;
