/**
 * @file resourceController.ts
 * @description 
 * Contains controller functions for handling resource-related operations.
 * Interfaces with the Resource model to perform CRUD operations.
 * Ensures proper validation and error handling for each operation.
 * Adheres to SOLID principles by maintaining single responsibility and modularity.
 */

import { Request, Response } from 'express';
import Resource from '../models/Resource';
import mongoose from 'mongoose';

/**
 * Retrieves all resources from the database.
 *
 * @param req - Express Request object.
 * @param res - Express Response object.
 */
export const getAllResources = async (req: Request, res: Response): Promise<void> => {
    try {
        const resources = await Resource.find({});
        res.status(200).json(resources);
    } catch (error) {
        console.error('Error fetching resources:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Retrieves a specific resource by its ID.
 *
 * @param req - Express Request object containing resourceId.
 * @param res - Express Response object.
 */
export const getResource = async (req: Request, res: Response): Promise<void> => {
    const { resourceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({ message: 'Invalid resource ID.' });
        return;
    }

    try {
        const resource = await Resource.findById(resourceId);

        if (!resource) {
            res.status(404).json({ message: 'Resource not found.' });
            return;
        }

        res.status(200).json(resource);
    } catch (error) {
        console.error('Error fetching resource:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Creates a new resource in the database.
 *
 * @param req - Express Request object containing resource data.
 * @param res - Express Response object.
 */
export const createResource = async (req: Request, res: Response): Promise<void> => {
    const { title, type, nodeId, content, imageUrl, quizType, quizContent } = req.body;

    // Validate required fields
    if (!title || typeof title !== 'string') {
        res.status(400).json({ message: 'Title is required and must be a string.' });
        return;
    }

    if (!type || !['cueCard', 'picture', 'practiceSheet'].includes(type)) {
        res.status(400).json({ message: 'Valid resource type is required.' });
        return;
    }

    if (!nodeId || typeof nodeId !== 'string') {
        res.status(400).json({ message: 'Valid nodeId is required.' });
        return;
    }

    try {
        const newResource = new Resource({
            title,
            type,
            nodeId,
            content: type === 'cueCard' || type === 'practiceSheet' ? content : undefined,
            imageUrl: type === 'picture' ? imageUrl : undefined,
            quizType: type === 'practiceSheet' ? quizType : undefined,
            quizContent: type === 'practiceSheet' ? quizContent : undefined,
        });

        await newResource.save();
        res.status(201).json(newResource);
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Updates an existing resource in the database.
 *
 * @param req - Express Request object containing resourceId and update data.
 * @param res - Express Response object.
 */
export const updateResource = async (req: Request, res: Response): Promise<void> => {
    const { resourceId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({ message: 'Invalid resource ID.' });
        return;
    }

    // Define allowed fields for updates based on resource type
    const allowedFields = ['title', 'content', 'imageUrl', 'quizType', 'quizContent'];
    const actualUpdates = Object.keys(updates);
    const isValidOperation = actualUpdates.every((field) => allowedFields.includes(field));

    if (!isValidOperation) {
        res.status(400).json({ message: 'Invalid updates. Only title, content, imageUrl, quizType, and quizContent can be updated.' });
        return;
    }

    try {
        const updatedResource = await Resource.findByIdAndUpdate(resourceId, updates, { new: true });

        if (!updatedResource) {
            res.status(404).json({ message: 'Resource not found.' });
            return;
        }

        // Include version number in response
        res.status(200).json({
            resource: updatedResource,
            __v: updatedResource.__v,
        });
    } catch (error) {
        console.error('Error updating resource:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};


/**
 * Deletes a resource from the database.
 *
 * @param req - Express Request object containing resourceId.
 * @param res - Express Response object.
 */
export const deleteResource = async (req: Request, res: Response): Promise<void> => {
    const { resourceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({ message: 'Invalid resource ID.' });
        return;
    }

    try {
        const deletedResource = await Resource.findByIdAndDelete(resourceId);

        if (!deletedResource) {
            res.status(404).json({ message: 'Resource not found.' });
            return;
        }

        res.status(200).json({ message: 'Resource deleted successfully.' });
    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
