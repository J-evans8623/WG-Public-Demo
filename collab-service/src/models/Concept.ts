// collab-service/src/models/Concept.ts

/**
 * @file Concept.ts
 * @description 
 * Defines the Mongoose schema and model for Concept documents.
 * Represents concept nodes within the collaborative study service.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface representing a Concept document in MongoDB.
 */
export interface IConcept extends Document {
    title: string;
    parentNodeId?: mongoose.Types.ObjectId;
    childrenNodeIds?: mongoose.Types.ObjectId[];
    isRoot?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ConceptSchema: Schema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        parentNodeId: {
            type: Schema.Types.ObjectId,
            ref: 'Concept',
            default: null,
        },
        childrenNodeIds: [{
            type: Schema.Types.ObjectId,
            ref: 'Concept',
        }],
        x: {
            type: Number,
            default: 0,
        },
        y: {
            type: Number,
            default: 0,
        },
        depth: {
            type: Number,
            required: true,
            default: 0,
        },
        isRoot: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

export default mongoose.model<IConcept>('Concept', ConceptSchema);
