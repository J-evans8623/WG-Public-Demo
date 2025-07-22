// File: app/studygraph/(studygraph)/components/layout/ReviewModal/ReviewModal.tsx

/**
 * @file ReviewModal.tsx
 * @description
 *   Implements the "Start Review" modal with review options and delegates
 *   the performance view to a separate `PerformanceTab` component.
 *
 * Responsibilities:
 *   • Always initialize internal state hooks before any conditional returns.
 *   • Render modal overlay and centered dialog when `isOpen` is true.
 *   • Provide two review modes: Interleaved Review and Unit Review.
 *   • Include a performance icon on the Interleaved option to toggle into the Performance tab.
 *   • Delegate quiz performance rendering to `PerformanceTab`.
 *   • Invoke parent callbacks when a review mode is selected.
 */

import React, { useState, useMemo } from 'react';
import { TrendingUp, X } from 'lucide-react';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useResourceScanner } from '../../hooks/resourceScanner';
import PerformanceTab from './PerformanceTab';
import type { PracticeSheetResource } from '@/app/Library/Definitions/Definitions';
import type { QuizItemStats } from '@/app/Library/Definitions/UserDataDefinitions';
import type { LessonStats, PerformanceMetrics } from './types';
// ─────────────────────────── Utility Import ───────────────────────────
import { computeQuizStats } from './quizStats';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInterleaved: () => void;
  onSelectUnit: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onSelectInterleaved,
  onSelectUnit,
}) => {
  const [activeTab, setActiveTab] = useState<'options' | 'performance'>('options');
  const [selectedOption, setSelectedOption] = useState<'interleaved' | 'unit' | null>(null);

  const { userRevisionData } = useUserData();
  const lessonModule = useLessonModule().getLessonModule();
  const allQuizzes = useResourceScanner()
    .getAllQuizzes()
    .filter((q): q is PracticeSheetResource => q.type === 'practiceSheet');

  // ─────────────────────────── Compute Performance Metrics ──────────────────────────
  const performanceMetrics = useMemo<PerformanceMetrics>(() => {
    // 1️⃣ If no data, return zeros.
    if (!userRevisionData) {
      return {
        globalAverage: 0,
        quizzesAttempted: 0,
        differential: 0,
        lessonStats: [],
      };
    }

    // 2️⃣ Compute global totals & average.
    const { totalAttempts, totalCorrect, average: globalAverage } =
      computeQuizStats(userRevisionData.quizStats);

    // 3️⃣ Grab previous snapshot values.
    const prevGlobalAverage      = userRevisionData.previousGlobalAverage      ?? 0;
    const prevLessonAverages     = userRevisionData.previousLessonAverages     ?? {};

    // 4️⃣ Compute global differential.
    const differential = globalAverage - prevGlobalAverage;

    // 5️⃣ Group stats by lesson (mapId).
    const statsByLesson: Record<string, QuizItemStats[]> = {};
    Object.values(userRevisionData.quizStats).forEach(s => {
      (statsByLesson[s.mapId] ||= []).push(s);
    });

    // 6️⃣ Build per-lesson metrics.
    const lessonStats: LessonStats[] = lessonModule.conceptMaps.map(cm => {
      const arr = statsByLesson[cm.id] || [];

      // 6.a total attempts & correct in this lesson
      const attempted = arr.reduce((sum, s) => sum + s.totalAttempts, 0);
      const correct   = arr.reduce(
        (sum, s) => sum + (s.totalAttempts - s.incorrectAttempts),
        0
      );

      // 6.b lesson average percentage
      const average = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

      // 6.c how many questions this lesson contains
      const totalQuestions = allQuizzes.filter(q => q.mapId === cm.id).length;

      // 6.d when this lesson was last attempted
      const lastTs    = arr.reduce((mx, s) => Math.max(mx, s.lastAttempted), 0);
      const lastTaken = lastTs ? new Date(lastTs).toLocaleString() : 'Never';

      // 6.e differential vs previous lesson snapshot
      const prevLessonAvg      = prevLessonAverages[cm.id] ?? 0;
      const lessonDifferential = average - prevLessonAvg;

      return {
        lessonId:      cm.id,
        lessonTitle:   cm.title,
        average,
        differential:  lessonDifferential,
        attempted,
        correct,
        total:         totalQuestions,
        lastTaken,
      };
    });

    // 🔟 Return the assembled metrics.
    return {
      globalAverage,
      quizzesAttempted:userRevisionData.GlobalQuizAttempts ?? 0,
      differential,
      lessonStats,
    };
  }, [userRevisionData, lessonModule.conceptMaps, allQuizzes]);

  if (!isOpen) return null;

  // ───────────────────────────── Render ─────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-hidden">
        {activeTab === 'options' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Choose Review Style</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Interleaved Review */}
              <div
                className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                  selectedOption === 'interleaved'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedOption('interleaved')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Interleaved Review</h3>
                  <button
                    onClick={() => setActiveTab('performance')}
                    className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-100"
                    title="View Performance"
                  >
                    <TrendingUp size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Mixes lessons; builds durable recall through spaced practice.
                </p>
              </div>

              {/* Unit Review */}
              <div
                className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                  selectedOption === 'unit'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedOption('unit')}
              >
                <h3 className="font-semibold text-gray-900 mb-1">Unit Review</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Stays in this lesson; ideal for first learning and gap checks.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  selectedOption === 'interleaved'
                    ? onSelectInterleaved()
                    : onSelectUnit()
                }
                disabled={!selectedOption}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${
                  selectedOption
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Start Quiz
              </button>
            </div>
          </>
        ) : (
          <PerformanceTab
            metrics={performanceMetrics}
            onBack={() => setActiveTab('options')}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default ReviewModal;
