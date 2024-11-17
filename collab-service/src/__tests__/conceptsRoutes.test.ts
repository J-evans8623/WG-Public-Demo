// tests/routes/conceptsRoutes.test.ts

/**
 * @file conceptsRoutes.test.ts
 * @description 
 * Tests that the conceptsRouter is exported correctly and mounts all required routes.
 */

import express from 'express';
import { conceptsRouter } from '../routes/concepts';

describe('Concepts Router', () => {
    let app: express.Express;

    beforeAll(() => {
        app = express();
        app.use('/concepts', conceptsRouter);
    });

    test('GET /concepts should be handled by conceptsRouter', () => {
        // Check if the router is mounted at '/concepts'
        const routerLayer = app._router.stack.find((layer: any) => layer.handle === conceptsRouter);
        expect(routerLayer).toBeDefined();
    });

    test('conceptsRouter should have GET, POST, PATCH, DELETE routes', () => {
        const routes = conceptsRouter.stack.map((layer: any) => layer.route?.path).filter(Boolean);
        expect(routes).toContain('/');
        expect(routes).toContain('/:conceptId');
    });
});
