// pages/api/analytics/track-conversion.ts

/***************************************************************************************************
 * @file pages/api/analytics/track-conversion.ts
 * @description
 * This file serves as the centralized ingestion point for the "Catch" phase of our guerrilla 
 * marketing analytics architecture. Its primary responsibility is to record a "Conversion Event"
 * whenever a user successfully lands on a document via a campaign link. 
 * * Unlike standard access logs, this endpoint performs a "Context Snapshot." It queries the 
 * target document's current state (Title, Lesson Count) and freezes that data alongside the 
 * user's identity. This ensures that even if the document changes later, our analytics reflect 
 * what the user actually saw when they converted.
 * * It implements robust deduplication using a deterministic composite key (userId + docId) to 
 * ensure that repeated page refreshes or revisits by the same user do not inflate the 
 * conversion counts. This endpoint is critical for answering business questions regarding 
 * user acquisition sources, university demographics (via email domain), and content engagement.
 ***************************************************************************************************/

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';
import * as admin from 'firebase-admin';

/**
 * @function handler
 * @description
 * The main API handler for tracking marketing conversions. It validates the HTTP method,
 * enforces user authentication via the session, prevents duplicate logging for the same 
 * user/document pair, extracts domain intelligence from the user's email, and persists 
 * a comprehensive snapshot of the conversion event to Firestore.
 * * Time Complexity: O(1) - Firestore reads and writes are key-based operations independent 
 * of collection size.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Method Guard: Only allow POST requests for state-changing operations
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 2. Authentication: Verify the session exists
  // We only track logged-in users to ensure data quality and attribution.
  // Anonymous scans are tracked via traffic logs, but "Conversions" require an identity.
  const session = await authenticateRequest(req, res);
  if (!session) {
    // authenticateRequest handles the 401 response automatically
    return;
  }

  const { docId, source } = req.body;
  const user = session.user;

  // 3. Input Validation
  if (!docId || typeof docId !== 'string' || !user?.email) {
    return res.status(400).json({ error: 'Missing required fields: docId or user email' });
  }

  try {
    // 4. Deduplication Strategy
    // We use a composite key of `userEmail_docId` to create a deterministic ID.
    // This allows us to check for existence in O(1) time without querying.
    const compositeKey = `${user.email}_${docId}`;
    const conversionRef = firestore.collection('marketing_conversions').doc(compositeKey);
    const conversionSnap = await conversionRef.get();

    // If this specific user has already been "converted" by this specific document,
    // we return early. We are interested in unique acquisitions, not total page views.
    if (conversionSnap.exists) {
      return res.status(200).json({ status: 'already_tracked', message: 'Conversion previously recorded' });
    }

    // 5. Context Snapshotting
    // We fetch the document metadata *now* to record what the user is seeing.
    // This answers Question 7 (Title) and Question 10 (Lesson Count).
    const docMetaSnap = await firestore.collection('userFiles').doc(docId).get();
    
    // If the doc doesn't exist (deleted or invalid ID), we log a warning but still record the attempt
    // with fallback values to ensure the traffic source is captured.
    const docData = docMetaSnap.exists ? docMetaSnap.data() : null;
    
    const entryDocTitle = docData?.fileName || 'Unknown/Deleted Document';
    
    // Calculate lesson count safely based on the lessonUnitsMeta structure
    let entryLessonCount = 0;
    if (docData?.lessonUnitsMeta?.totalUnits && typeof docData.lessonUnitsMeta.totalUnits === 'number') {
       entryLessonCount = docData.lessonUnitsMeta.totalUnits;
    }

    // 6. Domain Extraction
    // This answers Question 8 (University inference).
    // We split on the '@' symbol and take the second part.
    const emailDomain = user.email.split('@')[1] || 'unknown';

    // 7. Persistence
    // We write the log entry. We use serverTimestamp() for authoritative timing.
    await conversionRef.set({
      userId: user.email, // Using email as the stable identifier for this analytics context
      email: user.email,
      emailDomain: emailDomain.toLowerCase(),
      convertedAt: admin.firestore.FieldValue.serverTimestamp(),
      campaignSource: source || 'unknown',
      entryDocId: docId,
      entryDocTitle: entryDocTitle,
      entryLessonCount: entryLessonCount
    });

    console.log(`[Analytics] Conversion tracked for ${user.email} on doc ${docId}`);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Analytics] Conversion tracking failed:', error);
    // We return a 500 but log the error on the server. 
    // The frontend treats this as fire-and-forget, so this won't block the user.
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}