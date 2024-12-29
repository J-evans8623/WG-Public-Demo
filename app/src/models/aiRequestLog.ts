/**
 * models/aiRequestLog.ts
 * 
 * Defines the Mongoose schema and model for logging AI requests.
 * 
 * Responsibilities:
 * - Store metadata for AI interactions, including schema details.
 * - Record request input, schema validation status, and errors for debugging.
 * - Ensure proper indexing for performance during queries.
 * 
 * Dependencies:
 * - Mongoose for schema and model definition.
 */

import mongoose, { Document, Schema } from "mongoose";

/**
 * Interface for AI Request Log documents.
 */
export interface IAIRequestLog extends Document {
  userId: string;
  inputText: string;
  parameters: Record<string, unknown>;
  schemaName: string; // Name of the schema used for validation
  validationStatus: boolean; // Indicates if the response passed schema validation
  errorDetails: string | null; // Stores any parsing or validation errors
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
    schemaName: { type: String, required: true }, // New field to log schema name
    validationStatus: { type: Boolean, default: false }, // New field for schema validation status
    errorDetails: { type: String, default: null }, // New field for parsing or validation errors
    moderationFlag: { type: Boolean, default: false },
  },
  { timestamps: true } // Automatically manages createdAt and updatedAt fields
);

/**
 * Mongoose model for AI request logs.
 */
const AIRequestLogModel = mongoose.model<IAIRequestLog>(
  "AIRequestLog",
  AIRequestLogSchema
);

export default AIRequestLogModel;
