// File: app/studygraph/(studygraph)/components/layout/ReviewModal/PerformanceTab.tsx

import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { PerformanceMetrics, LessonStats } from './types';

export interface PerformanceTabProps {
  metrics: PerformanceMetrics;
  onBack: () => void;
  onClose: () => void;
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({
  metrics,
  onBack,
  onClose,
}) => {
  const {
    globalAverage,
    quizzesAttempted,
    differential,
    lessonStats,
  } = metrics;

  const getDifferentialColor = (d: number) => {
    if (d > 0) return 'text-green-600';
    if (d < 0) return 'text-orange-500';
    return 'text-gray-600';
  };

  const getDifferentialSign = (d: number) => (d > 0 ? '+' : '');

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            Quiz Performance Overview
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
        {/* Global Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {globalAverage}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Global Average</div>
            <div
              className={`text-sm font-semibold mt-1 ${getDifferentialColor(
                differential
              )}`}
            >
              {getDifferentialSign(differential)}
              {differential}%
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {quizzesAttempted}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Quizzes Attempted
            </div>
          </div>
        </div>

        {/* Lesson Performance */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-4">
            Lesson Performance
          </h4>
          <div className="space-y-3">
            {lessonStats.map((stat: LessonStats) => (
              <div
                key={stat.lessonId}
                className="bg-gray-50 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm leading-tight">
                      {stat.lessonTitle}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Last attempted: {stat.lastTaken}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-700">
                        Average:{' '}
                        <span className="font-semibold">
                          {stat.average}%
                        </span>
                      </span>
                      <span
                        className={`font-semibold ${getDifferentialColor(
                          stat.differential
                        )}`}
                      >
                        {getDifferentialSign(stat.differential)}
                        {stat.differential}%
                      </span>
                      <span className="text-gray-600">
                        {stat.attempted > 0
                          ? `Questions: ${stat.correct}/${stat.attempted}`
                          : 'No attempts'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end p-6 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
};

export default PerformanceTab;
