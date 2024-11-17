// collab-service/src/socketHandlers.ts

/**
 * @file socketHandlers.ts
 * @description 
 * Contains functions to handle Socket.IO events for real-time collaboration.
 * Manages concept and resource updates, ensuring synchronization across all clients.
 * Updated to reflect the removal of 'description', 'x', 'y', and 'depth' fields in concepts.
 */

import { Server, Socket } from 'socket.io';
import Concept from './models/Concept';
import Resource from './models/Resource';
import { IUser } from './models/User';

/**
 * Handles Socket.IO events related to concepts.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The connected socket instance.
 */
const handleConceptEvents = (io: Server, socket: Socket) => {
    /**
     * Adds a new concept and broadcasts it to other clients.
     */
    socket.on('concept:add', async (data, callback) => {
        try {
            const { title, parentNodeId, isRoot } = data;

            if (!title || typeof title !== 'string') {
                if (callback) callback({ status: 'error', message: 'Title is required and must be a string.' });
                return;
            }

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

            io.emit('concept:added', newConcept);
            if (callback) callback({ status: 'ok', concept: newConcept });
        } catch (error) {
            console.error('Error adding concept:', error);
            if (callback) callback({ status: 'error', message: 'Failed to add concept.' });
        }
    });

    /**
     * Updates an existing concept and broadcasts the update to other clients.
     */
    socket.on('concept:update', async (data, callback) => {
        try {
            const { conceptId, updates } = data;

            if (!conceptId || !updates) {
                if (callback) callback({ status: 'error', message: 'conceptId and updates are required.' });
                return;
            }

            // Only allow updating of 'title', 'parentNodeId', and 'isRoot' fields
            const allowedUpdates = ['title', 'parentNodeId', 'isRoot'];
            const actualUpdates = Object.keys(updates);
            const isValidOperation = actualUpdates.every((field) => allowedUpdates.includes(field));

            if (!isValidOperation) {
                if (callback) callback({ status: 'error', message: 'Invalid updates. Only title, parentNodeId, and isRoot can be updated.' });
                return;
            }

            const updatedConcept = await Concept.findByIdAndUpdate(conceptId, updates, { new: true });

            if (!updatedConcept) {
                if (callback) callback({ status: 'error', message: 'Concept not found.' });
                return;
            }

            // If parentNodeId is updated, update the childrenNodeIds of old and new parents
            if (updates.parentNodeId) {
                // Remove from old parent's childrenNodeIds
                await Concept.findOneAndUpdate({ childrenNodeIds: conceptId }, { $pull: { childrenNodeIds: conceptId } });

                // Add to new parent's childrenNodeIds
                await Concept.findByIdAndUpdate(updates.parentNodeId, { $push: { childrenNodeIds: conceptId } });
            }

            io.emit('concept:updated', updatedConcept);
            if (callback) callback({ status: 'ok', concept: updatedConcept });
        } catch (error) {
            console.error('Error updating concept:', error);
            if (callback) callback({ status: 'error', message: 'Failed to update concept.' });
        }
    });

    /**
     * Deletes a concept and broadcasts the deletion to other clients.
     */
    socket.on('concept:delete', async (data, callback) => {
        try {
            const { conceptId } = data;

            if (!conceptId) {
                if (callback) callback({ status: 'error', message: 'conceptId is required.' });
                return;
            }

            const deletedConcept = await Concept.findByIdAndDelete(conceptId);

            if (!deletedConcept) {
                if (callback) callback({ status: 'error', message: 'Concept not found.' });
                return;
            }

            // If the concept has a parent, remove it from the parent's childrenNodeIds
            if (deletedConcept.parentNodeId) {
                await Concept.findByIdAndUpdate(deletedConcept.parentNodeId, { $pull: { childrenNodeIds: conceptId } });
            }

            // Optionally, handle deletion of child concepts or reassign them as needed

            io.emit('concept:deleted', { conceptId });
            if (callback) callback({ status: 'ok', conceptId });
        } catch (error) {
            console.error('Error deleting concept:', error);
            if (callback) callback({ status: 'error', message: 'Failed to delete concept.' });
        }
    });
};

/**
 * Handles Socket.IO events related to resources.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The connected socket instance.
 */
const handleResourceEvents = (io: Server, socket: Socket) => {
    /**
     * Adds a new resource and broadcasts it to other clients.
     */
    socket.on('resource:add', async (data, callback) => {
        try {
            const { title, type, nodeId, content, imageUrl, quizType, quizContent } = data;

            if (!title || typeof title !== 'string') {
                if (callback) callback({ status: 'error', message: 'Title is required and must be a string.' });
                return;
            }

            if (!type || !['cueCard', 'picture', 'practiceSheet'].includes(type)) {
                if (callback) callback({ status: 'error', message: 'Valid resource type is required.' });
                return;
            }

            if (!nodeId || typeof nodeId !== 'string') {
                if (callback) callback({ status: 'error', message: 'Valid nodeId is required.' });
                return;
            }

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

            io.emit('resource:added', newResource);
            if (callback) callback({ status: 'ok', resource: newResource });
        } catch (error) {
            console.error('Error adding resource:', error);
            if (callback) callback({ status: 'error', message: 'Failed to add resource.' });
        }
    });

    /**
     * Updates an existing resource and broadcasts the update to other clients.
     */
    socket.on('resource:update', async (data, callback) => {
        try {
            const { resourceId, updates } = data;

            if (!resourceId || !updates) {
                if (callback) callback({ status: 'error', message: 'resourceId and updates are required.' });
                return;
            }

            // Only allow updating of 'title', 'content', 'imageUrl', 'quizType', and 'quizContent' based on resource type
            const allowedFields = ['title', 'content', 'imageUrl', 'quizType', 'quizContent'];
            const actualUpdates = Object.keys(updates);
            const isValidOperation = actualUpdates.every((field) => allowedFields.includes(field));

            if (!isValidOperation) {
                if (callback) callback({ status: 'error', message: 'Invalid updates. Only title, content, imageUrl, quizType, and quizContent can be updated.' });
                return;
            }

            const updatedResource = await Resource.findByIdAndUpdate(resourceId, updates, { new: true });

            if (!updatedResource) {
                if (callback) callback({ status: 'error', message: 'Resource not found.' });
                return;
            }

            io.emit('resource:updated', updatedResource);
            if (callback) callback({ status: 'ok', resource: updatedResource });
        } catch (error) {
            console.error('Error updating resource:', error);
            if (callback) callback({ status: 'error', message: 'Failed to update resource.' });
        }
    });

    /**
     * Deletes a resource and broadcasts the deletion to other clients.
     */
    socket.on('resource:delete', async (data, callback) => {
        try {
            const { resourceId } = data;

            if (!resourceId) {
                if (callback) callback({ status: 'error', message: 'resourceId is required.' });
                return;
            }

            const deletedResource = await Resource.findByIdAndDelete(resourceId);

            if (!deletedResource) {
                if (callback) callback({ status: 'error', message: 'Resource not found.' });
                return;
            }

            io.emit('resource:deleted', { resourceId });
            if (callback) callback({ status: 'ok', resourceId });
        } catch (error) {
            console.error('Error deleting resource:', error);
            if (callback) callback({ status: 'error', message: 'Failed to delete resource.' });
        }
    });
};

/**
 * Main function to handle all relevant Socket.IO events.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The connected socket instance.
 */
export const handleSocketEvents = (io: Server, socket: Socket) => {
    handleConceptEvents(io, socket);
    handleResourceEvents(io, socket);

    // Additional event handlers can be added here
};
