// File: app/workspace/(studygraph)/components/layout/ReviewModal/types.ts

import type { QuizItemStats } from '@/app/Library/Definitions/UserDataDefinitions';
import type { PracticeSheetResource } from '@/app/Library/Definitions/Definitions';
import { formatDistanceToNow } from 'date-fns';

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
