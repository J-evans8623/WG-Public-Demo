/**
 * @file PracticeSheet.ts
 * @description 
 * Defines the Mongoose schema and model for PracticeSheet documents.
 * Represents practice sheet resources within the collaborative study service.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { IResource } from './Resource';

/**
 * Interface representing a PracticeSheet document in MongoDB.
 */
export interface IPracticeSheet extends IResource {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem';
    quizContent: string;
}

/**
 * Schema for PracticeSheet, extending the base Resource schema using Mongoose discriminators.
 */
const PracticeSheetSchema: Schema = new Schema(
    {
        quizType: {
            type: String,
            required: true,
            enum: ['matching', 'multipleChoice', 'wordProblem'],
        },
        quizContent: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

/**
 * Mongoose model for PracticeSheet.
 * Uses discriminator from the base Resource model.
 */
export default mongoose.model<IPracticeSheet>('PracticeSheet', PracticeSheetSchema);
