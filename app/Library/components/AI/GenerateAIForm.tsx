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
import { ConceptNode, ResourceCard, ResourceType } from '../../Definitions/Definitions';
import { createNewNode } from '../../Context/nodesActions';
import './GenerateAIForm.css'; // Assuming you have corresponding CSS for styling

const { Option } = Select;

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
  const { dispatch: nodesDispatch } = useNodesContext();

  const [generationOption, setGenerationOption] = useState<'Lesson' | 'Quiz'>('Lesson');
  const [inputType, setInputType] = useState<'text' | 'pdf'>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /**
   * Handler for generation option change.
   * 
   * @param value - The selected generation option ('Lesson', 'Quiz').
   */
  const handleOptionChange = (value: 'Lesson' | 'Quiz') => {
    setGenerationOption(value);
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

  /**
   * Handler for form submission.
   * 
   * @param e - The form submission event.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) {
      setError('Please log in to use AI services.');
      setLoading(false);
      return;
    }

    try {
      let responseData: any;

      if (inputType === 'text') {
        if (!textInput.trim()) {
          setError('Please enter some text.');
          setLoading(false);
          return;
        }

        responseData = await generateAIContent({
          option: generationOption,
          inputType: 'text',
          text: textInput,
        }, user.accessToken);
      } else if (inputType === 'pdf') {
        if (!pdfFile) {
          setError('Please attach a PDF file.');
          setLoading(false);
          return;
        }

        responseData = await generateAIContent({
          option: generationOption,
          inputType: 'pdf',
          pdf: pdfFile,
        }, user.accessToken);
      }

      if (responseData.status === 'success') {
        const aiContent = responseData.content;

        if (generationOption === 'Lesson' || generationOption === 'Quiz') {
          // Determine the resource type based on generation option
          let resourceType: 'cueCard' | 'practiceSheet';
          if (generationOption === 'Lesson') {
            resourceType = 'cueCard';
          } else {
            resourceType = 'practiceSheet';
          }

          // Construct the resource object
          const newResource: ResourceCard = {
            id: uuidv4(),
            type: resourceType,
            nodeId: sourceNodeId, // Attach to the source node
            title: generationOption === 'Lesson' ? 'AI Generated Lesson' : 'AI Generated Quiz',
            content: generationOption === 'Lesson' 
              ? [{ type: 'paragraph', children: [{ text: aiContent }] }] 
              : { quizType: 'matching', quizContent: aiContent }, // Assuming aiContent is formatted accordingly
            source: 'AI Generation',
            ...(resourceType === 'practiceSheet' ? { content: aiContent } : {}),
          };

          // Add the new resource to ResourceContext
          addResource(newResource);

          message.success(`${generationOption} generated successfully!`);
          onClose(); // Close the tool panel after successful generation
        }
      } else {
        setError(responseData.message || 'AI generation failed.');
      }
    } catch (err) {
      console.error('AI Generation error:', err);
      setError('AI generation failed due to a server error.');
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

        {/* Input Type Selection */}
        <div className="form-group">
          <label htmlFor="inputType">Input Type:</label>
          <Select
            id="inputType"
            value={inputType}
            onChange={handleInputTypeChange}
            style={{ width: '100%' }}
          >
            <Option value="text">Text</Option>
            <Option value="pdf">PDF</Option>
          </Select>
        </div>

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
