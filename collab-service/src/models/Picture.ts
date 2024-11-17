/**
 * @file Picture.ts
 * @description 
 * Defines the Mongoose schema and model for Picture documents.
 * Represents picture resources within the collaborative study service.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { IResource } from './Resource';

/**
 * Interface representing a Picture document in MongoDB.
 */
export interface IPicture extends IResource {
    imageUrl: string;
    description?: string;
}

/**
 * Schema for Picture, extending the base Resource schema using Mongoose discriminators.
 */
const PictureSchema: Schema = new Schema(
    {
        imageUrl: {
            type: String,
            required: true,
            trim: true,
            match: [
                /^https?:\/\/.*\.(?:png|jpg|jpeg|gif|svg)$/,
                'Please use a valid image URL.',
            ],
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

/**
 * Mongoose model for Picture.
 * Uses discriminator from the base Resource model.
 */
export default mongoose.model<IPicture>('Picture', PictureSchema);
