/**
 * @file PersonalizedEdit.ts
 * @description 
 * Defines the Mongoose schema and model for PersonalizedEdit documents.
 * Represents user-specific customizations within the collaborative study service.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface representing a PersonalizedEdit document in MongoDB.
 */
export interface IPersonalizedEdit extends Document {
    userId: mongoose.Types.ObjectId;
    resourceId: mongoose.Types.ObjectId;
    editedContent: mongoose.Schema.Types.Mixed;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Schema for PersonalizedEdit.
 * Associates user-specific customizations with resources or concepts.
 */
const PersonalizedEditSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        resourceId: {
            type: Schema.Types.ObjectId,
            ref: 'Resource',
            required: true,
        },
        editedContent: {
            type: Schema.Types.Mixed,
            required: true,
        },
        isPublic: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

/**
 * Mongoose model for PersonalizedEdit.
 */
export default mongoose.model<IPersonalizedEdit>('PersonalizedEdit', PersonalizedEditSchema);
