// src/utils/db.ts

import mongoose from 'mongoose';

/**
 * Initializes the MongoDB connection using Mongoose.
 * Connects to the URI specified in environment variables.
 */
export const initializeDBConnection = async () => {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
        console.error('MONGO_URI is not defined in environment variables.');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        } as mongoose.ConnectOptions);
        console.log('Connected to MongoDB successfully.');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }

    // Handle connection events
    mongoose.connection.on('connected', () => {
        console.log('Mongoose connected to MongoDB.');
    });

    mongoose.connection.on('error', (err) => {
        console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.log('Mongoose disconnected from MongoDB.');
    });

    // Gracefully handle application termination
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('Mongoose connection closed due to application termination.');
        process.exit(0);
    });
};
