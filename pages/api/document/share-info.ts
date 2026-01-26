/**
 * @file pages/api/document/share-info.ts
 * @description 
 * This is a public-facing, read-only API endpoint designed to facilitate 
 * social sharing metadata retrieval. It follows the WiseGraph BFF pattern 
 * by acting as a secure proxy between the public internet and the internal 
 * Firestore database. Its sole responsibility is to provide the notebook 
 * title and asset counts (lessons, flashcards, quizzes) to the Dynamic 
 * Image Engine. Unlike other document APIs, this endpoint does not require 
 * an active user session, as it must be accessible to third-party web 
 * crawlers (Discord, Slack, etc.). To prevent data leakage, it strictly 
 * filters the Firestore response to return only the requested metadata, 
 * keeping sensitive fields like ownerId and storage paths hidden.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
// Note: We use the existing admin initialization pattern from your firebase.ts
import { firestore } from '@/app/src/services/firebase';

/**
 * @function handler
 * @description 
 * Handles the GET request for document share information. It extracts 
 * the docId from the query, performs a direct Firestore lookup, and 
 * returns a sanitized JSON object. If the document is missing or 
 * invalid, it returns a 404 to ensure crawlers fallback to defaults.
 * @param {NextApiRequest} req - The incoming request containing 'docId'.
 * @param {NextApiResponse} res - The outgoing JSON response.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Enforce GET method only for read operations
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { docId } = req.query;

  // 2. Validate the document identifier
  if (!docId || typeof docId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid docId' });
  }

  try {
    // 3. O(1) direct lookup in the userFiles collection
    const docRef = firestore.collection('userFiles').doc(docId);
    const docSnap = await docRef.get();

    // 4. Handle missing documents gracefully for the crawler
    if (!docSnap.exists) {
      console.warn(`[share-info.ts] Document ${docId} not found for public fetch.`);
      return res.status(404).json({ error: 'Document not found' });
    }

    const data = docSnap.data();

    // 5. SANITIZATION: Explicitly pick only non-sensitive fields.
    // We do NOT return the whole 'data' object to avoid exposing ownerId or paths.
    const shareMetadata = {
      title: data?.fileName || 'Untitled Notebook',
      lessons: data?.lessonCount || 0,
      cards: data?.cardCount || 0,
      quizzes: data?.quizCount || 0,
    };

    // 6. Set cache headers to optimize crawler performance and reduce DB hits
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    
    return res.status(200).json(shareMetadata);

  } catch (error: any) {
    console.error('[share-info.ts] Error fetching public metadata:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}