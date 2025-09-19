// app/studygraph/(studygraph)/components/layout/ReviewModal/PerformanceTab.tsx

/**
 * @file PerformanceTab.tsx
 * @description
 *   Content-only view that renders quiz performance metrics inside the Review modal’s body.
 *   The header (with back/close) and the single scroll container are provided by the parent
 *   modal; this component purposely avoids its own max-heights and overflow to prevent the
 *   double-scrollbar issue observed earlier. Spacing relies on the modal system’s CSS.
 */

import React from 'react';
import type { PerformanceMetrics, LessonStats } from './types';

export interface PerformanceTabProps {
  metrics: PerformanceMetrics;
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({ metrics }) => {
  const { globalAverage, quizzesAttempted, differential, lessonStats } = metrics;

  const diffColor = (d: number) =>
    d > 0 ? '#059669' : d < 0 ? '#D97706' : '#6B7280';

  const sign = (d: number) => (d > 0 ? '+' : '');

  return (
    <div>
      {/* Global cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ background: '#F3F4F6', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2C3E50' }}>
            {globalAverage}%
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Global Average</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: diffColor(differential) }}>
            {sign(differential)}
            {differential}%
          </div>
        </div>

        <div style={{ background: '#F3F4F6', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2C3E50' }}>
            {quizzesAttempted}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Quizzes Attempted</div>
        </div>
      </div>

      {/* Lesson list */}
      <div>
        <h4 style={{ fontWeight: 600, color: '#2C3E50', marginBottom: 12 }}>Lesson Performance</h4>
        <div style={{ display: 'grid', gap: 12 }}>
          {lessonStats.map((stat: LessonStats) => (
            <div key={stat.lessonId} style={{ background: '#F3F4F6', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#2C3E50', fontSize: 14, lineHeight: 1.2 }}>
                    {stat.lessonTitle}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    Last attempted: {stat.lastTaken}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <span style={{ color: '#374151' }}>
                      Average: <span style={{ fontWeight: 700 }}>{stat.average}%</span>
                    </span>
                    <span style={{ fontWeight: 700, color: diffColor(stat.differential) }}>
                      {sign(stat.differential)}
                      {stat.differential}%
                    </span>
                    <span style={{ color: '#4B5563' }}>
                      {stat.attempted > 0 ? `Questions: ${stat.correct}/${stat.attempted}` : 'No attempts'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {lessonStats.length === 0 && (
            <div style={{ fontSize: 14, color: '#6B7280' }}>No data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceTab;
