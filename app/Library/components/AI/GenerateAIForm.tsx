// GenerateAIForm.tsx
// bloom-maps/app/Library/components/AI/GenerateAIForm.tsx

/**
 * GenerateAIForm.tsx
 * 
 * Provides a form for users to input text or attach a PDF and request AI-generated content.
 * Supports generating "Lesson" and "Quiz" based on user selection.
 * 
 * Dependencies:
 * - React and React hooks
 * - Ant Design components
 * - Contexts for authentication and resources
 * - Utility functions for API calls and resource saving
 * - UUID for unique identifiers
 */

import React, { useState, useContext, ChangeEvent, FormEvent } from 'react';
import { AuthContext } from '../../../src/context/AuthContext';
import { useResourceContext } from '../../Context/ResourceContext';
import { useNodesContext } from '../../Context/NodesProvider';
import { generateAIContent } from '../../utils/api';
import { Button, Select, Upload, message, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { updateNodeTitle } from '../../Context/nodesActions';
import { translateLessonToCueCards, translateQuizToPracticeSheets } from './responseTranslator';
import { saveResource } from '../../utils/ResourceSave/saveResource';
import './GenerateAIForm.css';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setNodes } from '@/app/Library/Context/nodesActions';
import { useSubTreeContext, SubtreeData } from '@/app/Library/Context/SubTreeProvider';
import { compositeLayout } from './layoutUtils';
const { Option } = Select;

export enum QuizType {
  MULTIPLE_CHOICE = 'multipleChoice',
  MATCHING = 'matching',
  FILL_IN_BLANK = 'FIB',
  TRUE_FALSE = 'true-false'
}

interface GenerateAIFormProps {
  onClose: () => void; // Prop to handle closing the tool panel
  sourceNodeId: string; // New prop to identify the source node
}

/**
 * GenerateAIForm Component
 * 
 * Renders a form that allows users to generate AI content based on input text or PDF.
 * Supports generating Lessons and Quizzes.
 * 
 * @param onClose - Function to handle closing the form.
 * @param sourceNodeId - The ID of the source node to attach generated content.
 * 
 * @returns JSX Element representing the AI generation form.
 */
const GenerateAIForm: React.FC<GenerateAIFormProps> = ({ onClose, sourceNodeId }) => {
  const { user } = useContext(AuthContext);
  const { addResource } = useResourceContext();
  const { dispatch: nodesDispatch, nodes } = useNodesContext();
  const [generationOption, setGenerationOption] = useState<'Lesson' | 'Quiz'>('Lesson');
  const [inputType, setInputType] = useState<'text' | 'pdf'>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { subtrees, setSubtrees } = useSubTreeContext();
  const [quizType, setQuizType] = useState<QuizType>(QuizType.MULTIPLE_CHOICE);
  /**
   * Handler for generation option change.
   * 
   * @param value - The selected generation option ('Lesson', 'Quiz').
   */
  const handleOptionChange = (value: 'Lesson' | 'Quiz') => {
    setGenerationOption(value);
  };

  const handleQuizTypeChange = (value: QuizType) => {
    setQuizType(value);
  };

  /**
   * Handler for input type change.
   * 
   * @param value - The selected input type ('text' or 'pdf').
   */
  const handleInputTypeChange = (value: 'text' | 'pdf') => {
    setInputType(value);
    // Reset inputs when changing input type
    setTextInput('');
    setPdfFile(null);
    setError('');
  };

  /**
   * Handler for text input change.
   * 
   * @param e - The change event from the textarea.
   */
  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
  };

  /**
   * Handler for PDF upload.
   * 
   * @param info - Information about the uploaded file.
   */
  const handlePdfUpload = (info: any) => {
    if (info.file.status === 'done' || info.file.status === 'uploading') {
      // Accept only PDF files
      const file = info.file.originFileObj as File;
      if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        setError('');
      } else {
        message.error('Only PDF files are allowed.');
      }
    }
  };

  const processAIResponse = async (responseData: any) => {
    try {
      // Step 1: Take snapshot of current data
      console.log('GenerateAI-=== INITIAL SNAPSHOT ===');
      const localNodes = new Map(nodes);
      const localSubtrees = new Map(subtrees);
      
      // Convert Maps to objects for better console logging
      const nodesSnapshot = Object.fromEntries(localNodes.entries());
      const subtreesSnapshot = Object.fromEntries(localSubtrees.entries());
      
      console.log('GenerateAI-Initial nodes:', {
        count: localNodes.size,
        data: nodesSnapshot
      });
      console.log('GenerateAI-Initial subtrees:', {
        count: localSubtrees.size,
        data: subtreesSnapshot
      });
  
      // Update root node title
      const rootNodeId = sourceNodeId;
      const rootNodeTitle = generationOption === 'Lesson' ? 
        responseData.rootConcept.concept : 
        responseData.title;
      
      
  
      if (generationOption === 'Lesson') {
        // Process root concept cue cards
        if (responseData.rootConcept.cueCards) {
          console.log('GenerateAI-=== PROCESSING ROOT CUE CARDS ===');
          console.log(`Processing ${responseData.rootConcept.cueCards.length} cue cards for root node`);
          for (const cueCard of responseData.rootConcept.cueCards) {
            await saveResource({
              resourceType: 'cueCard',
              nodeId: rootNodeId,
              addResource,
              Title: cueCard.title,
              cueCardContent: [{ 
                type: 'paragraph', 
                children: [{ text: cueCard.description }] 
              }]
            });
          }
        }
  
        // Step 2: Process and add concept nodes one at a time in hierarchy order
        const processSubtopicsInOrder = async (subtopics: any[], parentNodeId: string, depth: number) => {
          console.log(`\n=== PROCESSING DEPTH ${depth} NODES ===`);
          console.log(`Number of subtopics at depth ${depth}: ${subtopics.length}`);
          
          // First pass: Create all nodes at current depth level
          for (const subtopic of subtopics) {
            const subtopicNodeId = uuidv4();
            console.log(`\nProcessing subtopic: ${subtopic.concept}`);
            
            // Create new node in local state
            const newNode: ConceptNode = {
              id: subtopicNodeId,
              title: subtopic.concept,
              parentNodeId: parentNodeId,
              childrenNodeIds: [],
              depth: depth,
              x: undefined,
              y: undefined
            };
            
            // Add node to local state
            localNodes.set(subtopicNodeId, newNode);
            
            // Update parent's children array in local state
            const parentNode = localNodes.get(parentNodeId);
            if (parentNode) {
              parentNode.childrenNodeIds = [...(parentNode.childrenNodeIds || []), subtopicNodeId];
            }
  
            console.log('GenerateAI-Node created:', {
              id: subtopicNodeId,
              title: subtopic.concept,
              depth: depth,
              parentId: parentNodeId
            });
  
            // Step 3: Update layout immediately after adding each node
            console.log('GenerateAI-\nUpdating layout...');
            compositeLayout({
              nodes: localNodes,
              localSubtrees: localSubtrees,
              setSubtrees: setSubtrees,
              setNodes: (updatedNodes) => {
                // Update local nodes with layout changes
                for (const [nodeId, node] of updatedNodes.entries()) {
                  localNodes.set(nodeId, node);
                }
              }
            });
  
            console.log('GenerateAI-Layout updated. Current state:', {
              totalNodes: localNodes.size,
              totalSubtrees: localSubtrees.size,
              lastAddedNode: {
                id: subtopicNodeId,
                position: {
                  x: localNodes.get(subtopicNodeId)?.x,
                  y: localNodes.get(subtopicNodeId)?.y
                }
              }
            });
  
            // Process cue cards
            if (subtopic.cueCards) {
              console.log(`Processing ${subtopic.cueCards.length} cue cards for node ${subtopicNodeId}`);
              for (const cueCard of subtopic.cueCards) {
                await saveResource({
                  resourceType: 'cueCard',
                  nodeId: subtopicNodeId,
                  addResource,
                  Title: cueCard.title,
                  cueCardContent: [{ 
                    type: 'paragraph', 
                    children: [{ text: cueCard.description }] 
                  }]
                });
              }
            }
          }
  
          // Second pass: Process next depth level
          for (const subtopic of subtopics) {
            if (subtopic.subtopics && subtopic.subtopics.length > 0) {
              const parentSubtopicId = Array.from(localNodes.entries())
                .find(([_, node]) => node.title === subtopic.concept)?.[0];
              
              if (parentSubtopicId) {
                await processSubtopicsInOrder(subtopic.subtopics, parentSubtopicId, depth + 1);
              }
            }
          }
        };
  
        // Start processing from depth 1 (children of root)
        if (responseData.rootConcept.subtopics) {
          console.log('GenerateAI-\n=== STARTING SUBTOPIC PROCESSING ===');
          console.log('GenerateAI-Root subtopics count:', responseData.rootConcept.subtopics.length);
          await processSubtopicsInOrder(responseData.rootConcept.subtopics, rootNodeId, 1);
        }
  
        // Step 4: Final update to React context
        console.log('GenerateAI-\n=== FINAL STATE UPDATE ===');
        console.log('GenerateAI-Final nodes state:', {
          count: localNodes.size,
          nodes: Object.fromEntries(localNodes.entries())
        });
        console.log('GenerateAI-Final subtrees state:', {
          count: localSubtrees.size,
          subtrees: Object.fromEntries(localSubtrees.entries())
        });
        
        nodesDispatch(setNodes(localNodes));
        nodesDispatch(updateNodeTitle(sourceNodeId, rootNodeTitle));
        setSubtrees(localSubtrees);
  
      } else {
        // Handle Quiz generation
        console.log('GenerateAI-=== PROCESSING QUIZ ===');
        const practiceSheet = translateQuizToPracticeSheets(responseData, rootNodeId);
        await saveResource({
          resourceType: 'practiceSheet',
          nodeId: rootNodeId,
          addResource,
          Title: practiceSheet.title,
          practiceSheetContent: practiceSheet.content
        });
      }
  
      message.success(`${generationOption} generated successfully!`);
      onClose();
    } catch (error) {
      console.error('Error processing AI response:', error);
      message.error('Failed to process AI response');
    }
  };
  



  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user || !user.accessToken) {
      setError('Please log in to use AI services.');
      setLoading(false);
      return;
    }

    try {
      const responseData = await generateAIContent({
        option: generationOption,
        quizType: generationOption === 'Quiz' ? quizType : undefined,
        inputType: 'text',
        text: textInput,
      }, user.accessToken);

      await processAIResponse(responseData);
      message.success(`${generationOption} generated successfully!`);
      onClose();
    } catch (err) {
      console.error('AI Generation error:', err);
      setError(err instanceof Error ? err.message : 'AI generation failed due to a server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="generate-ai-form">
      <h2>Generate AI Resource</h2>
      <form onSubmit={handleSubmit}>
        {/* Generation Option Selection */}
        <div className="form-group">
          <label htmlFor="generationOption">Select Generation Type:</label>
          <Select
            id="generationOption"
            value={generationOption}
            onChange={handleOptionChange}
            style={{ width: '100%' }}
          >
            <Option value="Lesson">Lesson</Option>
            <Option value="Quiz">Quiz</Option>
          </Select>
        </div>

        {/* Quiz Type Selection - Only show when Quiz is selected */}
        {generationOption === 'Quiz' && (
          <div className="form-group">
            <label htmlFor="quizType">Select Quiz Type:</label>
            <Select
              id="quizType"
              value={quizType}
              onChange={handleQuizTypeChange}
              style={{ width: '100%' }}
            >
              <Option value={QuizType.MULTIPLE_CHOICE}>Multiple Choice</Option>
              <Option value={QuizType.MATCHING}>Matching</Option>
              <Option value={QuizType.FILL_IN_BLANK}>Fill in the Blank</Option>
              <Option value={QuizType.TRUE_FALSE}>True/False</Option>
            </Select>
          </div>
        )}

        {/* Text Input */}
        {inputType === 'text' && (
          <div className="form-group">
            <label htmlFor="textInput">Enter Text:</label>
            <textarea
              id="textInput"
              value={textInput}
              onChange={handleTextChange}
              placeholder="Enter your study content..."
              rows={6}
              required
            />
          </div>
        )}

        {/* PDF Upload */}
        {inputType === 'pdf' && (
          <div className="form-group">
            <label htmlFor="pdfUpload">Attach PDF:</label>
            <Upload
              beforeUpload={() => false} // Prevent automatic upload
              accept="application/pdf"
              onChange={handlePdfUpload}
              showUploadList={true}
            >
              <Button icon={<UploadOutlined />}>Click to Upload</Button>
            </Upload>
          </div>
        )}

        {/* Error Message */}
        {error && <p className="error-message">{error}</p>}

        {/* Submit Button */}
        <div className="form-group">
          <Button type="primary" htmlType="submit" disabled={loading} block>
            {loading ? <Spin /> : 'Generate'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default GenerateAIForm;
