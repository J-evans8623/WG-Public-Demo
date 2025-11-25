// src/services/study-planner/models/index.ts
/**
 * @file models/index.ts
 * @description
 * [Responsibility & Scope]
 * This barrel file centralizes exports for all model interfaces and configuration types
 * used by the Study Planner Service. By consolidating imports to a single access point,
 * we improve maintainability, readability, and ergonomics for consumers while reducing
 * the risk of import path drift as the codebase grows. External modules should depend on
 * these curated exports rather than reaching into individual files, which preserves
 * encapsulation and simplifies future refactors (e.g., relocating files or splitting
 * modules). The barrel contains no logic, only type exports, ensuring it is safe,
 * side-effect free, and tree-shakeable.
 */

// Progress tracking models
export * from './Progress';

// Lesson models
export * from './Lesson';

// Learning set models
export * from './LearningSet';

// Output models
export * from './StudyPlanOutput';

// Configuration models
export * from './Configuration';
