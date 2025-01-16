// File: src/utils/SessionDocumentMapper.ts

/**
 * @file SessionDocumentMapper.ts
 * @description
 * Provides utility functions to map sessions to documents and vice versa using Redis.
 * This facilitates efficient tracking of which sessions are editing which documents.
 *
 * Dependencies:
 * - redis.ts (existing Redis client)
 */

import { console } from 'inspector';
import redisClient from '../config/redis'; 

/**
 * Adds a session to a document's session set in Redis.
 * @param documentId - The ID of the document.
 * @param sessionId - The ID of the session.
 */
export const addSessionToDocument = async (documentId: string, sessionId: string): Promise<void> => {
  console.log('Calling: addSessionToDocument');
  const documentSessionsKey = `document:${documentId}:sessions`;
  const sessionDocumentKey = `session:${sessionId}:document`;

  const pipeline = redisClient.getClient().pipeline();
  pipeline.sadd(documentSessionsKey, sessionId);
  pipeline.set(sessionDocumentKey, documentId, 'EX', 3600); // Set TTL to 1 hour
  await pipeline.exec();
};

export const updateSessionTTL = async (sessionId: string): Promise<void> => {
  console.log('Updating TTL for session:', sessionId);
  const sessionDocumentKey = `session:${sessionId}:document`;
  await redisClient.getClient().expire(sessionDocumentKey, 3600); // Reset TTL to 1 hour
};

/**
 * Removes a session from a document's session set in Redis.
 * @param documentId - The ID of the document.
 * @param sessionId - The ID of the session.
 */
export const removeSessionFromDocument = async (documentId: string, sessionId: string): Promise<void> => {
  console.log('Calling : ......removeSessionFromDocument')
  const documentSessionsKey = `document:${documentId}:sessions`;
  const sessionDocumentKey = `session:${sessionId}:document`;

  const pipeline = redisClient.getClient().pipeline();
  pipeline.srem(documentSessionsKey, sessionId);
  pipeline.del(sessionDocumentKey);
  await pipeline.exec();
};

/**
 * Maps a session to a document in Redis.
 * @param sessionId - The ID of the session.
 * @param documentId - The ID of the document.
 */
export const mapSessionToDocument = async (sessionId: string, documentId: string): Promise<void> => {
  console.log('Calling : ......mapSessionToDocument')
  const sessionDocumentKey = `session:${sessionId}:document`;

  await redisClient.getClient().set(sessionDocumentKey, documentId);
  console.log(`Session ${sessionDocumentKey} successfully mapped to document : ${documentId}`);
};

/**
 * Unmaps a session from its document in Redis.
 * @param sessionId - The ID of the session.
 */
export const unmapSessionFromDocument = async (sessionId: string): Promise<void> => {
  console.log('Calling : ...... unmapSessionFromDocument')
  const sessionDocumentKey = `session:${sessionId}:document`;

  await redisClient.getClient().del(sessionDocumentKey);
};

/**
 * Retrieves all session IDs associated with a document.
 * @param documentId - The ID of the document.
 * @returns An array of session IDs.
 */
export const getSessionsByDocument = async (documentId: string): Promise<string[]> => {
  console.log('Calling : ......getSessionsByDocument ')
  const documentSessionsKey = `document:${documentId}:sessions`;
  const sessions = await redisClient.getClient().smembers(documentSessionsKey);
  console.log(`Document id : ${documentId} is mapped to ${sessions}`);
  console.log('leaving : ......getSessionsByDocument ')
  return sessions;
};

/**
 * Retrieves the document ID associated with a session.
 * @param sessionId - The ID of the session.
 * @returns The document ID or null if not found.
 */
export const getDocumentBySession = async (sessionId: string): Promise<string | null> => {
  console.log('Calling : .... getDocumentBySession')
  const sessionDocumentKey = `session:${sessionId}:document`;
  console.log(`Retrieving sessionDocumentKey:  ${sessionDocumentKey} ...`);
  const documentId = await redisClient.getClient().get(sessionDocumentKey);
  console.log(`Retrieved sessionDocumentKey entry:  ${documentId} ...`);
  return documentId;
};
