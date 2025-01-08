/**
 * File: /server/queues/autosaveQueue.ts
 * Responsibility: Manage autosave tasks to avoid concurrency issues.
 * Dependencies:
 *   - bullmq for queue management.
 */

import { Queue, Worker } from 'bullmq';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
};

// Define the queue
const autosaveQueue = new Queue('autosave', { connection: redisConnection });

/**
 * Add an autosave task to the queue.
 * @param jobName - Name of the autosave task.
 * @param data - Task-specific data (e.g., document ID, content).
 */
export const addAutosaveTask = async (jobName: string, data: any): Promise<void> => {
  await autosaveQueue.add(jobName, data, { attempts: 3 });
};

// Worker to process autosave tasks
const worker = new Worker(
  'autosave',
  async (job) => {
    // Simulate saving data to a database or external API
    console.log(`Processing autosave job: ${job.name}`, job.data);
    // Save logic here...
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed`, err);
});
