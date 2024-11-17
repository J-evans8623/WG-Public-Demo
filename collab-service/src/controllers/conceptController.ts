// collab-service/src/controllers/conceptController.ts

/**
 * @file conceptController.ts
 * @description 
 * Contains controller functions for handling concept-related operations.
 * Interfaces with the Concept model to perform CRUD operations.
 * Ensures proper validation and error handling for each operation.
 * Updated to reflect the removal of 'description', 'x', 'y', and 'depth' fields.
 */

import { Request, Response } from 'express';
import Concept from '../models/Concept';
import mongoose from 'mongoose';

/**
 * Retrieves all concepts from the database.
 *
 * @param req - Express Request object.
 * @param res - Express Response object.
 */
export const getAllConcepts = async (req: Request, res: Response): Promise<void> => {
    try {
        const concepts = await Concept.find({});
        res.status(200).json(concepts);
    } catch (error) {
        console.error('Error fetching concepts:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Creates a new concept in the database.
 *
 * @param req - Express Request object containing concept data.
 * @param res - Express Response object.
 */
export const createConcept = async (req: Request, res: Response): Promise<void> => {
    const { title, parentNodeId, isRoot } = req.body;

    if (!title || typeof title !== 'string') {
        res.status(400).json({ message: 'Title is required and must be a string.' });
        return;
    }

    try {
        const newConcept = new Concept({
            title,
            parentNodeId: parentNodeId || null,
            isRoot: isRoot || false,
        });

        await newConcept.save();

        // If the concept has a parent, update the parent's childrenNodeIds
        if (parentNodeId) {
            await Concept.findByIdAndUpdate(parentNodeId, { $push: { childrenNodeIds: newConcept._id } });
        }

        res.status(201).json(newConcept);
    } catch (error) {
        console.error('Error creating concept:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Updates an existing concept in the database.
 *
 * @param req - Express Request object containing concept ID and update data.
 * @param res - Express Response object.
 */
export const updateConcept = async (req: Request, res: Response): Promise<void> => {
    const { conceptId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(conceptId)) {
        res.status(400).json({ message: 'Invalid concept ID.' });
        return;
    }

    // Only allow updating of 'title', 'parentNodeId', and 'isRoot' fields
    const allowedUpdates = ['title', 'parentNodeId', 'isRoot'];
    const actualUpdates = Object.keys(updates);
    const isValidOperation = actualUpdates.every((field) => allowedUpdates.includes(field));

    if (!isValidOperation) {
        res.status(400).json({ message: 'Invalid updates. Only title, parentNodeId, and isRoot can be updated.' });
        return;
    }

    try {
        const updatedConcept = await Concept.findByIdAndUpdate(conceptId, updates, { new: true });

        if (!updatedConcept) {
            res.status(404).json({ message: 'Concept not found.' });
            return;
        }

        // If parentNodeId is updated, update the childrenNodeIds of old and new parents
        if (updates.parentNodeId) {
            // Remove from old parent's childrenNodeIds
            await Concept.findOneAndUpdate({ childrenNodeIds: conceptId }, { $pull: { childrenNodeIds: conceptId } });

            // Add to new parent's childrenNodeIds
            await Concept.findByIdAndUpdate(updates.parentNodeId, { $push: { childrenNodeIds: conceptId } });
        }

        res.status(200).json(updatedConcept);
    } catch (error) {
        console.error('Error updating concept:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Deletes a concept from the database.
 *
 * @param req - Express Request object containing concept ID.
 * @param res - Express Response object.
 */
export const deleteConcept = async (req: Request, res: Response): Promise<void> => {
    const { conceptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conceptId)) {
        res.status(400).json({ message: 'Invalid concept ID.' });
        return;
    }

    try {
        const deletedConcept = await Concept.findByIdAndDelete(conceptId);

        if (!deletedConcept) {
            res.status(404).json({ message: 'Concept not found.' });
            return;
        }

        // If the concept has a parent, remove it from the parent's childrenNodeIds
        if (deletedConcept.parentNodeId) {
            await Concept.findByIdAndUpdate(deletedConcept.parentNodeId, { $pull: { childrenNodeIds: conceptId } });
        }

        res.status(200).json({ message: 'Concept deleted successfully.' });
    } catch (error) {
        console.error('Error deleting concept:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
