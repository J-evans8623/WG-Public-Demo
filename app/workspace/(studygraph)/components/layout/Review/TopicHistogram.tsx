/**
 * @file TopicHistogram.tsx
 * @description
 * This file implements the TopicHistogram component, a specialized diagnostic tool designed for 
 * Educator-level analytics within the Quiz Feedback Pipeline. Its primary responsibility is 
 * to provide a high-fidelity visualization of conceptual gaps by plotting "Incorrect Responses" 
 * against human-readable "Topic Names." The component leverages the simplified token mapping 
 * system developed in Phase 1 and 3 to ensure that even though the AI generates data using 
 * short tokens (e.g., A0, A1) to prevent hallucination, the Educator views authoritative, 
 * scannable titles. It calculates struggle frequency proportionally against the total student 
 * population, allowing for immediate identification of concepts that require classroom-wide 
 * remediation. By providing this granular visibility, the component transforms raw assessment 
 * metadata into actionable instructional intelligence, directly supporting the sprint's goal 
 * of closing the feedback loop for both teachers and scholars. The rendering logic is 
 * strictly optimized for O(N) performance to ensure responsiveness in large-class environments.
 */

import React, { useMemo } from 'react';
import { BarChart3, AlertCircle, Users } from 'lucide-react';

export interface TopicHistogramProps {
  /** Map of topic tokens (e.g., 'A0') to the count of incorrect student responses. */
  incorrectCounts: Record<string, number>;
  /** Dictionary mapping tokens back to human-readable titles (e.g., {'A0': 'Photosynthesis'}). */
  topicMapping: Record<string, string>;
  /** The total number of students who have attempted the quiz for percentage context. */
  totalStudents: number;
}

/**
 * TopicHistogram
 * @description
 * This functional component transforms raw struggle metrics into a scannable diagnostic histogram. 
 * It reconciles simplified AI tokens with human-readable topic titles and renders a proportional 
 * bar chart that enables educators to pinpoint specific conceptual weaknesses in their class 
 * with zero-latency visual feedback.
 */
const TopicHistogram: React.FC<TopicHistogramProps> = ({
  incorrectCounts,
  topicMapping,
  totalStudents
}) => {
  // 1. Logic Step: Materialize and sort the data array for rendering (O(N) complexity)
  const chartData = useMemo(() => {
    return Object.entries(incorrectCounts).map(([token, count]) => ({
      token,
      title: topicMapping[token] || `Topic ${token}`,
      count: count,
      percentage: totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0
    })).sort((a, b) => b.count - a.count); // Show most struggled topics first
  }, [incorrectCounts, topicMapping, totalStudents]);

  // 2. Step 2: Determine the maximum count for proportional bar scaling
  const maxIncorrect = useMemo(() => {
    const counts = Object.values(incorrectCounts);
    return counts.length > 0 ? Math.max(...counts) : 0;
  }, [incorrectCounts]);

  // 3. Step 3: Handle empty state for quizzes with no attempts or zero failures
  if (chartData.length === 0) {
    return (
      <div className="histogram-empty" style={{ padding: '24px', textAlign: 'center', background: '#F9FAFB', borderRadius: '12px', border: '1px dashed #D1D5DB' }}>
        <BarChart3 size={32} color="#9CA3AF" style={{ marginBottom: '8px' }} />
        <p style={{ color: '#6B7280', margin: 0, fontSize: '14px' }}>No struggle data available for this assessment yet.</p>
      </div>
    );
  }

  return (
    <div className="topic-histogram-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="histogram-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={20} color="#374151" />
          <h4 style={{ margin: 0, color: '#111827' }}>Conceptual Struggle Heatmap</h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6B7280', background: '#F3F4F6', padding: '4px 8px', borderRadius: '999px' }}>
          <Users size={14} />
          <span>N = {totalStudents} Students</span>
        </div>
      </div>

      {/* 4. Step 4: Render the Histogram list with O(N) efficiency */}
      <div className="histogram-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {chartData.map((data) => (
          <div key={data.token} className="histogram-row" style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px', alignItems: 'center', gap: '16px' }}>
            <div className="topic-label" title={data.title} style={{ fontSize: '13px', fontWeight: 500, color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.title}
            </div>
            
            <div className="bar-wrapper" style={{ height: '12px', background: '#F3F4F6', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
              {/* 5. Step 5: Proportional bar scaling based on local max for visual contrast */}
              <div 
                className="bar-fill" 
                style={{ 
                  height: '100%', 
                  width: `${(data.count / (maxIncorrect || 1)) * 100}%`, 
                  background: data.percentage > 50 ? '#EF4444' : '#F59E0B',
                  borderRadius: '6px',
                  transition: 'width 0.6s ease-out'
                }} 
              />
            </div>

            <div className="count-label" style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: data.percentage > 50 ? '#B91C1C' : '#111827' }}>
                {data.percentage}%
              </span>
              {data.percentage > 50 && (
                <AlertCircle size={14} color="#EF4444" style={{ marginLeft: '4px', verticalAlign: 'middle' }} title="Priority Review Topic" />
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="histogram-footer" style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
        * Percentages indicate the portion of the class that answered questions for this topic incorrectly.
      </p>
    </div>
  );
};

export default TopicHistogram;