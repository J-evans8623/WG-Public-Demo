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
      console.log('1. GenerateAI-=== INITIAL SNAPSHOT ===');
      const localNodes = new Map(nodes);
      const localSubtrees = new Map(subtrees);
      
      const nodesSnapshot = Object.fromEntries(localNodes.entries());
      const subtreesSnapshot = Object.fromEntries(localSubtrees.entries());
      
      console.log('2. GenerateAI-Initial nodes:', {
        count: localNodes.size,
        data: nodesSnapshot
      });
      console.log('3. GenerateAI-Initial subtrees:', {
        count: localSubtrees.size,
        data: subtreesSnapshot
      });
  
      const subroot = localNodes.get(sourceNodeId) as ConceptNode;
      console.log('*******Is subroot valid?: ', subroot);
      console.log('*******Is subroot depth valid?: ', subroot.depth);
      const rootNodeId = sourceNodeId;
      const rootNodeTitle = generationOption === 'Lesson' ? 
        responseData.topic.title : 
        subroot.title;
  
      if (generationOption === 'Lesson') {
        // Process root concept slides (previously cue cards)
        if (responseData.topic.overview.length > 0) {
          console.log('4. GenerateAI-=== PROCESSING ROOT CUE CARDS ===');
          console.log(` 5. Processing ${responseData.topic.overview.length} cue cards for root node`);
          for (const slide of responseData.topic.overview) {
            await saveResource({
              resourceType: 'cueCard',
              nodeId: rootNodeId,
              addResource,
              Title: slide.title,
              cueCardContent: [{ 
                type: 'paragraph', 
                children: [{ text: slide.text }] 
              }]
            });
          }
        }
  
        const processSubtopicsInOrder = async (subtopics: any[], parentNodeId: string, depth: number) => {
          console.log(`\ 6. n=== PROCESSING DEPTH ${depth} NODES ===`);
          console.log(` 7. Number of subtopics at depth ${depth}: ${subtopics.length}`);
          
          for (const subtopic of subtopics) {
            const subtopicNodeId = uuidv4();
            console.log(`\n 8. Processing subtopic: ${subtopic}`);
            
            const newNode: ConceptNode = {
              id: subtopicNodeId,
              title: subtopic.title,
              parentNodeId: parentNodeId,
              childrenNodeIds: [],
              depth: depth,
              x: undefined,
              y: undefined
            };
            
            localNodes.set(subtopicNodeId, newNode);
            
            const parentNode = localNodes.get(parentNodeId);
            if (parentNode) {
              parentNode.childrenNodeIds = [...(parentNode.childrenNodeIds || []), subtopicNodeId];
            }
  
            console.log('9. GenerateAI-Node created:', {
              id: subtopicNodeId,
              title: subtopic.title,
              depth: depth,
              parentId: parentNodeId
            });
  
            console.log('&&# 10. GenerateAI-\nUpdating layout.... Current state:#&&', {
              totalNodes: localNodes.size,
              totalSubtrees: localSubtrees.size,
              lastAddedNode: {
                id: subtopicNodeId,
                position: {
                  x: localNodes.get(subtopicNodeId)?.x,
                  y: localNodes.get(subtopicNodeId)?.y
                }
              },
              lastAddedSubtree:{
                subtrees : localSubtrees
              },
            });
  
            compositeLayout({
              nodes: localNodes,
              localSubtrees: localSubtrees,
              setSubtrees: setSubtrees,
              setNodes: (updatedNodes) => {
                for (const [nodeId, node] of updatedNodes.entries()) {
                  localNodes.set(nodeId, node);
                }
              }
            });
  
            console.log('11 .GenerateAI-Layout updated. Current state:', {
              totalNodes: localNodes.size,
              totalSubtrees: localSubtrees.size,
              lastAddedNode: {
                id: subtopicNodeId,
                position: {
                  x: localNodes.get(subtopicNodeId)?.x,
                  y: localNodes.get(subtopicNodeId)?.y
                }
              },
              lastAddedSubtree:{
                data : localSubtrees.get(subtopicNodeId)
              },
            });
  
            // Process content slides
            const allSlides = [...subtopic.content];
             
            console.log(`12. Processing ${allSlides.length} cue cards for node ${subtopicNodeId}`);
            for (const slide of allSlides) {
              await saveResource({
                resourceType: 'cueCard',
                nodeId: subtopicNodeId,
                addResource,
                Title: slide.title,
                cueCardContent: [{ 
                  type: 'paragraph', 
                  children: [{ text: slide.text }] 
                }]
              });
            }
          }
          console.log(`\ 12-B . n=== End of PROCESSING DEPTH ${depth} NODES ===`);
  
          // Process concepts as next depth level
          for (const subtopic of subtopics) {
            if (subtopic.concept_bank && subtopic.concept_bank.length > 0) {
              const parentSubtopicId = Array.from(localNodes.entries())
                .find(([_, node]) => node.title === subtopic.title)?.[0];
              
              if (parentSubtopicId) {
                await processSubtopicsInOrder(subtopic.concept_bank, parentSubtopicId, depth + 1);
              }
            }
          }
        };
  
        if (responseData.topic.subtopics) {
          console.log('13. GenerateAI-\n=== STARTING SUBTOPIC PROCESSING ===');
          console.log('14. GenerateAI-Root subtopics count:', responseData.topic.subtopics.length);
          await processSubtopicsInOrder([...responseData.topic.subtopics, responseData.topic.review], rootNodeId, subroot.depth + 1);
        }
  
        console.log('15. GenerateAI-\n=== FINAL STATE UPDATE ===');
        console.log('16. GenerateAI-Final nodes state:', {
          count: localNodes.size,
          nodes: Object.fromEntries(localNodes.entries())
        });
        console.log('17 .GenerateAI-Final subtrees state:', {
          count: localSubtrees.size,
          subtrees: Object.fromEntries(localSubtrees.entries())
        });
        
        nodesDispatch(setNodes(localNodes));
        nodesDispatch(updateNodeTitle(sourceNodeId, rootNodeTitle));
        setSubtrees(localSubtrees);
  
      } else {
        console.log('18. GenerateAI-=== PROCESSING QUIZ ===');
        const practiceSheet = translateQuizToPracticeSheets(responseData, rootNodeId);
        await saveResource({
          resourceType: 'practiceSheet',
          nodeId: rootNodeId,
          addResource,
          Title: practiceSheet.title,
          practiceSheetContent: practiceSheet.content
        });
      }
  
      message.success(` 19. ${generationOption} generated successfully!`);
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
