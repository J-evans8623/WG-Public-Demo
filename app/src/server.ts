import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/authRoutes';
import connectDB from './config/db';

const app = express();

// Connect to MongoDB
connectDB();

// Middleware to parse JSON
app.use(express.json());

// API routes
app.use('/api', authRoutes);

// Error-handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
