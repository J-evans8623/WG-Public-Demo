/**
 * @file CueCard.ts
 * @description 
 * Defines the Mongoose schema and model for CueCard documents.
 * Represents cue card resources within the collaborative study service.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { IResource } from './Resource';

/**
 * Interface representing a CueCard document in MongoDB.
 */
export interface ICueCard extends IResource {
    content: string;
    bloomLevel: number;
}

/**
 * Schema for CueCard, extending the base Resource schema using Mongoose discriminators.
 */
const CueCardSchema: Schema = new Schema(
    {
        content: {
            type: String,
            required: true,
            trim: true,
        },
        bloomLevel: {
            type: Number,
            default: 1,
            min: 1,
            max: 6, // Assuming Bloom's taxonomy levels 1-6
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

/**
 * Mongoose model for CueCard.
 * Uses discriminator from the base Resource model.
 */
export default mongoose.model<ICueCard>('CueCard', CueCardSchema);
