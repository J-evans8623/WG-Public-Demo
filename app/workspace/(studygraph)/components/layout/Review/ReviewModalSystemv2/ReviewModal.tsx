/**
 * @file ReviewModalv2.tsx
 * @description
 * (update - 1.1)
 * This file has been refactored to exclusively govern the student-centric "Practice" and "Performance"
 * flow. All administrative and assessment-related logic has been decoupled and moved to the 
 * EducatorWorkSpaceModals orchestrator to adhere to the Single Responsibility Principle. 
 * The component maintains practice behaviors (Interleaved and Unit review) and provides an 
 * overview of quiz performance metrics with a single, consistent scroll container. 
 * It resolves layout defects by enforcing a single scrollbar and using dynamic headers: 
 * "Practice" for the selection view and "Quiz Performance Overview" for results. 
 * Time complexity remains O(N) for performance metric aggregation.
 */

import React, { useMemo, useState } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import { ArrowLeft } from 'lucide-react';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useResourceScanner } from '@/app/workspace/(studygraph)/components/hooks/resourceScanner';
import PerformanceTab from '@/app/workspace/(studygraph)/components/layout/Review/PerformanceTab';
import PracticeTab from '@/app/workspace/(studygraph)/components/layout/Review/PracticeTab';
// update - 1.2: Removed AssessmentTab import as it is now managed by EducatorWorkSpaceModals
import type { PracticeSheetResource } from '@/app/Library/Definitions/Definitions';
import type { QuizItemStats } from '@/app/Library/Definitions/UserDataDefinitions';
import type { LessonStats, PerformanceMetrics } from '@/app/workspace/(studygraph)/components/layout/Review/types';
import { computeQuizStats } from '@/app/workspace/(studygraph)/components/layout/Review/quizStats';
import { useYDoc } from '@/app/Library/Context/YDocContext';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Practice actions
  onSelectInterleaved: () => void;
  onSelectUnit: () => void;

  // update - 1.3: Removed onCreateAssignedQuiz and onViewGradebook props
}

// update - 1.4: Removed 'assessment' from ViewKey type
type ViewKey = 'practice' | 'performance';

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onSelectInterleaved,
  onSelectUnit,
}) => {
  // (update - 1.5) Simplified view controller
  const [view, setView] = useState<ViewKey>('practice');
  

  const { userRevisionData } = useUserData();
  const lessonModule = useLessonModule().getLessonModule();
  const allQuizzes = useResourceScanner()
    .getAllQuizzes()
    .filter((q): q is PracticeSheetResource => q.type === 'practiceSheet');

  /**
   * computePerformanceMetrics
   * @description
   * Aggregates user quiz statistics grouped by lesson and calculates differentials between 
   * current and previous performance snapshots. This memoized function ensures O(N) 
   * complexity relative to the number of quiz items, preventing redundant calculations 
   * during tab switches or modal re-renders.
   */
  const performanceMetrics = useMemo<PerformanceMetrics>(() => {
    console.log('[ReviewModalsv2.tsx][6123] computing performance metrics');
    if (!userRevisionData) {
      return { globalAverage: 0, quizzesAttempted: 0, differential: 0, lessonStats: [] };
    }

    const { average: globalAverage } = computeQuizStats(userRevisionData.quizStats);

    const prevGlobalAverage = userRevisionData.previousGlobalAverage ?? 0;
    const prevLessonAverages = userRevisionData.previousLessonAverages ?? {};
    const differential = globalAverage - prevGlobalAverage;

    const statsByLesson: Record<string, QuizItemStats[]> = {};
    Object.values(userRevisionData.quizStats).forEach((s) => {
      (statsByLesson[s.mapId] ||= []).push(s);
    });

    const lessonStats: LessonStats[] = lessonModule.conceptMaps.map((cm) => {
      const arr = statsByLesson[cm.id] || [];
      const attempted = arr.reduce((sum, s) => sum + s.totalAttempts, 0);
      const correct = arr.reduce((sum, s) => sum + (s.totalAttempts - s.incorrectAttempts), 0);
      const average = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      const totalQuestions = allQuizzes.filter((q) => q.mapId === cm.id).length;
      const lastTs = arr.reduce((mx, s) => Math.max(mx, s.lastAttempted), 0);
      const lastTaken = lastTs ? new Date(lastTs).toLocaleString() : 'Never';
      const prevLessonAvg = prevLessonAverages[cm.id] ?? 0;
      const lessonDifferential = average - prevLessonAvg;

      return {
        lessonId: cm.id,
        lessonTitle: cm.title,
        average,
        differential: lessonDifferential,
        attempted,
        correct,
        total: totalQuestions,
        lastTaken,
      };
    });

    console.log('[ReviewModalsv2.tsx][6124] metrics ready', {
      globalAverage,
      differential,
      lessons: lessonStats.length,
    });

    return {
      globalAverage,
      quizzesAttempted: userRevisionData.GlobalQuizAttempts ?? 0,
      differential,
      lessonStats,
    };
  }, [userRevisionData, lessonModule.conceptMaps, allQuizzes]);

  if (!isOpen) return null;

  // (update - 1.6) Refined dynamic header title
  const headerTitle =
    view === 'practice'
      ? 'Practice'
      : 'Quiz Performance Overview';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Review modal">
      <div className="modal-container rms-shell" style={{ width: 560, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="rms-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {view === 'performance' && (
              <button
                className="rms-close"
                onClick={() => {
                  console.log('[ReviewModalsv2.tsx][6126] back to practice');
                  setView('practice');
                }}
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="modal-title" style={{ margin: 0, textAlign: 'left' }}>
              {headerTitle}
            </h2>
          </div>

          <button
            className="rms-close"
            onClick={() => {
              console.log('[ReviewModalsv2.tsx][6125] close clicked');
              onClose();
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body (single scroll owner) */}
        <div className="rms-body">
          <div className="rms-body-inner">
            {/* update - 1.7: Removed tab navigation as only 'Practice' remains in this view */}
            
            {/* Content panes — keep them overflow-visible to avoid nested scrollbars */}
            {view === 'practice' && (
              <div className="rms-avoid-nested-scroll">
                <PracticeTab
                  onSelectInterleaved={onSelectInterleaved}
                  onSelectUnit={onSelectUnit}
                  onCancel={onClose}
                  onViewPerformance={() => {
                    console.log('[ReviewModalsv2.tsx][6129] go to performance');
                    setView('performance');
                  }}
                />
              </div>
            )}

            {/* update - 1.8: Removed conditional rendering of AssessmentTab */}

            {view === 'performance' && (
              <div className="rms-avoid-nested-scroll">
                <PerformanceTab metrics={performanceMetrics} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;