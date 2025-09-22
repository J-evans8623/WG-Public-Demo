// app/studygraph/(studygraph)/components/layout/ReviewModal/ReviewModalsv2.tsx

/**
 * @file ReviewModal.tsx
 * @description
 *   (update - 1)
 *   This file renders the enhanced Review modal experience and governs a three-view flow:
 *   “Practice”, “Assessment”, and “Performance”. The component preserves the legacy practice
 *   behaviors (Interleaved and Unit review), and adds Assessment and Performance views with a
 *   single, consistent scroll container. This version also resolves layout defects previously
 *   reported: the footer controls no longer float (they sit at the visual bottom thanks to a
 *   flexible shell with a dedicated body scroller), the UI shows only one scrollbar (owned by
 *   the body element), and the close “X” is now a borderless icon button to match the design
 *   language. Spacing utilities in a scoped stylesheet increase padding and gaps so cards,
 *   tabs, and lists do not feel cramped; the scroll gutter no longer hugs content. Finally,
 *   the header text is dynamic—“Start Review” for Practice, “Assessment” for Assessment, and
 *   “Quiz Performance Overview” for Performance—removing previous title ambiguity. Time
 *   complexity remains O(N) for performance metric aggregation and O(1) for tab switching.
 *
 * Responsibilities:
 *   1) Render a shell with header and a single scrollable body to avoid nested scroll bars.
 *   2) Maintain the active view: 'practice' | 'assessment' | 'performance'.
 *   3) Compute and memoize performance metrics and pass them to PerformanceTab.
 *   4) Provide dynamic header title and optional back button for Performance view.
 *   5) Propagate callbacks for starting practice modes and assessment actions.
 */

import React, { useMemo, useState } from 'react';
import '@/app/studygraph/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css'; /* (update - 2) scoped layout/spacer fixes */
import { ArrowLeft } from 'lucide-react';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useResourceScanner } from '../../hooks/resourceScanner';
import PerformanceTab from './PerformanceTab';
import PracticeTab from './PracticeTab';
import AssessmentTab from './AssessmentTab';
import type { PracticeSheetResource } from '@/app/Library/Definitions/Definitions';
import type { QuizItemStats } from '@/app/Library/Definitions/UserDataDefinitions';
import type { LessonStats, PerformanceMetrics } from './types';
import { computeQuizStats } from './quizStats';
import { useYDoc } from '@/app/Library/Context/YDocContext';


export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Practice actions
  onSelectInterleaved: () => void;
  onSelectUnit: () => void;

  // Assessment actions (optional)
  onCreateAssignedQuiz?: () => void;
  onViewGradebook?: () => void;
}

type ViewKey = 'practice' | 'assessment' | 'performance';

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onSelectInterleaved,
  onSelectUnit,
  onCreateAssignedQuiz,
  onViewGradebook,
}) => {
  // (update - 3) view controller
  const [view, setView] = useState<ViewKey>('practice');
  const {docFileID} = useYDoc()

  const { userRevisionData } = useUserData();
  const lessonModule = useLessonModule().getLessonModule();
  const allQuizzes = useResourceScanner()
    .getAllQuizzes()
    .filter((q): q is PracticeSheetResource => q.type === 'practiceSheet');

  /**
   * computePerformanceMetrics
   * @returns O(N) aggregation of user quiz stats grouped by lesson with differentials
   * between the current and previous snapshots. The result is memoized against its inputs
   * to avoid unnecessary recomputation during tab switches or re-renders.
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

  // (update - 4) dynamic header title based on active view
  const headerTitle =
    view === 'practice'
      ? 'Practice'
      : view === 'assessment'
      ? 'Assessment'
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
            className="rms-close" /* (update - 5) borderless icon button */
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
            {/* Tabs are hidden on performance to maximize space */}
            {view !== 'performance' && (
              <div className="rms-tabs">
                <button
                  role="tab"
                  className="rms-tab-btn"
                  aria-selected={view === 'practice'}
                  onClick={() => {
                    setView('practice');
                    console.log('[ReviewModalsv2.tsx][6127] tab=practice');
                  }}
                >
                  Practice
                </button>
                <button
                  role="tab"
                  className="rms-tab-btn"
                  aria-selected={view === 'assessment'}
                  onClick={() => {
                    setView('assessment');
                    console.log('[ReviewModalsv2.tsx][6128] tab=assessment');
                  }}
                >
                  Assessment
                </button>
              </div>
            )}

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

            {view === 'assessment' && (
              <div className="rms-avoid-nested-scroll">
                <AssessmentTab
                
                  onCreateAssignedQuiz={onCreateAssignedQuiz}
                  onViewGradebook={onViewGradebook}
                  onClose={onClose} 
                  docId={docFileID!}
                  />
              </div>
            )}

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
