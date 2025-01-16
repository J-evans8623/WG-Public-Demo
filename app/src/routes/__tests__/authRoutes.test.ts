/**
 * authRoutes.test.ts
 * 
 * Test file for verifying the behavior of the `authRoutes.ts` abstract implementation.
 * This file ensures no false positives for the `/oauth/callback` silent endpoint.
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../../../../../Archived/utils/deprecated/authRoutes';

const app = express();
app.use('/api', authRoutes);

describe('authRoutes', () => {
  it('should return 501 for unimplemented /oauth/callback endpoint', async () => {
    const response = await request(app).get('/api/oauth/callback');
    expect(response.status).toBe(501);
    expect(response.text).toBe('Not implemented');
  });
});
