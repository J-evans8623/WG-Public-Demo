/**
 * models/aiRequestLog.ts
 * 
 * Defines the Mongoose schema and model for logging AI requests.
 * 
 * Responsibilities:
 * - Store request metadata for AI interactions.
 * - Include fields for user ID, input text, parameters, moderation flags, and timestamps.
 * - Ensure proper indexing for query performance.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface for AI Request Log documents.
 */
export interface IAIRequestLog extends Document {
  userId: string;
  inputText: string;
  parameters: Record<string, unknown>;
  moderationFlag: boolean;
  createdAt: Date;
}

/**
 * Mongoose schema for AI request logs.
 */
const AIRequestLogSchema = new Schema(
  {
    userId: { type: String, required: true },
    inputText: { type: String, required: true },
    parameters: { type: Schema.Types.Mixed, required: true },
    moderationFlag: { type: Boolean, default: false },
  },
  { timestamps: true } // Automatically manages createdAt and updatedAt fields
);

/**
 * Mongoose model for AI request logs.
 */
const AIRequestLogModel = mongoose.model<IAIRequestLog>('AIRequestLog', AIRequestLogSchema);

export default AIRequestLogModel;
