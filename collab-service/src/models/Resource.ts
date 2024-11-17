// collab-service/src/models/Resource.ts

/**
 * @file Resource.ts
 * @description 
 * Defines the Mongoose schema and model for Resource documents.
 * Represents various types of resources (cue cards, pictures, practice sheets) associated with concepts.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface representing a Resource document in MongoDB.
 */
export interface IResource extends Document {
    title: string;
    type: 'cueCard' | 'picture' | 'practiceSheet';
    nodeId: mongoose.Types.ObjectId;
    content?: string; // For cue cards and practice sheets
    imageUrl?: string; // For pictures
    quizType?: 'matching' | 'multipleChoice' | 'wordProblem'; // For practice sheets
    quizContent?: string; // For practice sheets
    createdAt: Date;
    updatedAt: Date;
}

const ResourceSchema: Schema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['cueCard', 'picture', 'practiceSheet'],
        },
        nodeId: {
            type: Schema.Types.ObjectId,
            ref: 'Concept',
            required: true,
        },
        content: {
            type: String,
            trim: true,
        },
        imageUrl: {
            type: String,
            trim: true,
        },
        quizType: {
            type: String,
            enum: ['matching', 'multipleChoice', 'wordProblem'],
        },
        quizContent: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

export default mongoose.model<IResource>('Resource', ResourceSchema);
