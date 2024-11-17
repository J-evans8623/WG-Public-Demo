/**
 * @file personalizedEditController.ts
 * @description
 * Contains controller functions for handling personalized edit operations.
 * Interfaces with the PersonalizedEdit model to perform CRUD operations.
 * Ensures proper validation and error handling for each operation.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PersonalizedEdit from '../models/PersonalizedEdit';
import Resource from '../models/Resource';
import Concept from '../models/Concept';

/**
 * Creates a new personalized edit.
 *
 * @param req - Express Request object containing edit data.
 * @param res - Express Response object.
 */
export const createPersonalizedEdit = async (req: Request, res: Response): Promise<void> => {
    const { resourceId, conceptId, editedContent, isPublic } = req.body;
    const userId = req.user?.id; // Now accessible due to type augmentation

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized: User ID is missing.' });
        return;
    }

    if (!editedContent) {
        res.status(400).json({ message: 'editedContent is required.' });
        return;
    }

    if (!resourceId && !conceptId) {
        res.status(400).json({ message: 'Either resourceId or conceptId must be provided.' });
        return;
    }

    try {
        // Validate that the referenced resource or concept exists
        if (resourceId) {
            if (!mongoose.Types.ObjectId.isValid(resourceId)) {
                res.status(400).json({ message: 'Invalid resourceId.' });
                return;
            }
            const resource = await Resource.findById(resourceId);
            if (!resource) {
                res.status(404).json({ message: 'Resource not found.' });
                return;
            }
        }

        if (conceptId) {
            if (!mongoose.Types.ObjectId.isValid(conceptId)) {
                res.status(400).json({ message: 'Invalid conceptId.' });
                return;
            }
            const concept = await Concept.findById(conceptId);
            if (!concept) {
                res.status(404).json({ message: 'Concept not found.' });
                return;
            }
        }

        const newEdit = new PersonalizedEdit({
            userId,
            resourceId: resourceId || undefined,
            conceptId: conceptId || undefined,
            editedContent,
            isPublic: isPublic || false,
        });

        await newEdit.save();

        res.status(201).json(newEdit);
    } catch (error) {
        console.error('Error creating personalized edit:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Retrieves all personalized edits for a user.
 *
 * @param req - Express Request object.
 * @param res - Express Response object.
 */
export const getPersonalizedEdits = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id; // Now accessible due to type augmentation

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized: User ID is missing.' });
        return;
    }

    try {
        const edits = await PersonalizedEdit.find({ userId });
        res.status(200).json(edits);
    } catch (error) {
        console.error('Error fetching personalized edits:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Updates an existing personalized edit.
 *
 * @param req - Express Request object containing edit ID and update data.
 * @param res - Express Response object.
 */
export const updatePersonalizedEdit = async (req: Request, res: Response): Promise<void> => {
    const { editId } = req.params;
    const { editedContent, isPublic } = req.body;
    const userId = req.user?.id; // Now accessible due to type augmentation

    if (!mongoose.Types.ObjectId.isValid(editId)) {
        res.status(400).json({ message: 'Invalid edit ID.' });
        return;
    }

    if (!editedContent && typeof isPublic === 'undefined') {
        res.status(400).json({ message: 'At least one of editedContent or isPublic must be provided.' });
        return;
    }

    try {
        const edit = await PersonalizedEdit.findById(editId);

        if (!edit) {
            res.status(404).json({ message: 'Personalized edit not found.' });
            return;
        }

        if (edit.userId.toString() !== userId) {
            res.status(403).json({ message: 'Forbidden: You can only edit your own personalized edits.' });
            return;
        }

        if (editedContent) edit.editedContent = editedContent;
        if (typeof isPublic !== 'undefined') edit.isPublic = isPublic;

        await edit.save();

        res.status(200).json(edit);
    } catch (error) {
        console.error('Error updating personalized edit:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Deletes a personalized edit.
 *
 * @param req - Express Request object containing edit ID.
 * @param res - Express Response object.
 */
export const deletePersonalizedEdit = async (req: Request, res: Response): Promise<void> => {
    const { editId } = req.params;
    const userId = req.user?.id; // Now accessible due to type augmentation

    if (!mongoose.Types.ObjectId.isValid(editId)) {
        res.status(400).json({ message: 'Invalid edit ID.' });
        return;
    }

    try {
        const edit = await PersonalizedEdit.findById(editId);

        if (!edit) {
            res.status(404).json({ message: 'Personalized edit not found.' });
            return;
        }

        if (edit.userId.toString() !== userId) {
            res.status(403).json({ message: 'Forbidden: You can only delete your own personalized edits.' });
            return;
        }

        await edit.deleteOne(); // Replaced 'remove()' with 'deleteOne()'

        res.status(200).json({ message: 'Personalized edit deleted successfully.' });
    } catch (error) {
        console.error('Error deleting personalized edit:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
