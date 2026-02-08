// File: app/workspace/(studygraph)/components/layout/ReviewModal/types.ts

export interface LessonStats {
  lessonId: string;
  lessonTitle: string;
  average: number;
  differential: number;
  attempted: number;
  correct: number;
  total: number;
  lastTaken: string;
}

export interface PerformanceMetrics {
  globalAverage: number;
  quizzesAttempted: number;
  differential: number;
  lessonStats: LessonStats[];
}
