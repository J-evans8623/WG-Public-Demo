/**
 * @file useQuizCRUD.ts
 * @description
 * This custom hook serves as the logic controller for the volatile "Draft" state of a quiz 
 * during an active editing session. Its primary responsibility is to provide a clean, 
 * side-effect-free interface for managing a local collection of IQuizQuestion objects. 
 * By maintaining a local buffer, the hook ensures that the UI remains highly performant 
 * and responsive, avoiding unnecessary global state re-renders during text input. 
 * It encapsulates the complexities of array manipulation, such as splicing items by ID 
 * and performing immutable updates on nested object properties. This abstraction allows 
 * the UI components to remain "dumb" or stateless, adhering to the Single Responsibility 
 * Principle (SRP) by separating data manipulation logic from visual presentation concerns.
 */

import { useState, useCallback } from 'react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';

export const useQuizCRUD = (initialQuestions: IQuizQuestion[]) => {
  // 1. Initialize local state with a shallow clone of the quiz data
  const [draftQuestions, setDraftQuestions] = useState<IQuizQuestion[]>(initialQuestions);

  /**
   * @function handleFieldChange
   * @description
   * Updates a specific field (question or answer) of a quiz item within the local draft 
   * state. It performs an immutable update by mapping through the current array and 
   * returning a new object for the matching ID. This ensures React's change detection 
   * triggers correctly for the individual field inputs.
   */
  const handleFieldChange = useCallback((id: string, field: 'question' | 'correctAnswer', value: any) => {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          // 2. Return a new object with the updated field value
          return { ...q, [field]: value };
        }
        return q;
      })
    );
  }, []);

  /**
   * @function handleRemoveItem
   * @description
   * Removes a quiz item from the local draft array based on its unique identifier. This 
   * operation is O(N) as it filters the entire collection to exclude the target item. 
   * Deletions performed here are volatile and will not affect the global resource map 
   * until the batch is saved.
   */
  const handleRemoveItem = useCallback((id: string) => {
    // 3. Filter out the item with the matching unique ID
    setDraftQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return {
    draftQuestions,
    handleFieldChange,
    handleRemoveItem,
  };
};