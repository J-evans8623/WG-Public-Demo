/**
 * @file app/marketing.config.ts
 *
 * @description
 * Single source of truth for all marketing routing and audience display decisions.
 *
 * Responsibilities:
 *  - Defines the AudienceType union used across all marketing pages
 *  - Exports DEFAULT_AUDIENCE: change this ONE value to redirect wisegraph.app/
 *    to a different audience landing page without touching any component code
 *  - Exports AUDIENCE_ROUTES: maps each audience to its destination URL
 *  - Exports AUDIENCE_LABELS: general human-readable labels for the audiences
 *  - Exports AUDIENCE_BUTTON_LABELS: user-facing singular labels specifically
 *    for the "I am a ..." selector pills
 *
 * Usage:
 *  import {
 *    DEFAULT_AUDIENCE,
 *    AUDIENCE_ROUTES,
 *    AUDIENCE_LABELS,
 *    AUDIENCE_BUTTON_LABELS,
 *    type AudienceType,
 *  } from '@/app/marketing.config';
 */

export type AudienceType = 'students' | 'learners' | 'educators';

/**
 * Controls which landing page wisegraph.app/ redirects to.
 * Change this one value to shift default targeting — no component edits needed.
 *
 * Options: 'students' | 'learners' | 'educators'
 */
export const DEFAULT_AUDIENCE: AudienceType = 'learners';

/**
 * Maps each audience to its landing page URL.
 * 'educators' temporarily points to /features until the educator page is built.
 */
export const AUDIENCE_ROUTES: Record<AudienceType, string> = {
  students: '/students',
  learners: '/learners',
  educators: '/features',
};

/**
 * General display labels for audiences.
 * These can be used in headings, analytics dashboards, or elsewhere when plural
 * wording is still appropriate.
 */
export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  students: 'Students',
  learners: 'Lifetime Learners',
  educators: 'Educators',
};

/**
 * User-facing singular labels for the audience selector pills.
 * These are written to work grammatically with the "I am a" helper label.
 */
export const AUDIENCE_BUTTON_LABELS: Record<AudienceType, string> = {
  students: 'Student',
  learners: 'Lifetime Learner',
  educators: 'Educator',
};