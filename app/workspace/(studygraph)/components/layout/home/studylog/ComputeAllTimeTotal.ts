/***************************************************************************************
 * @file ComputeAllTimeTotal.ts
 * @description
 * This utility file provides standardized arithmetic logic for aggregating study metrics
 * across the BloomMap application. Its primary responsibility is to act as a pure
 * functional layer that transforms raw notebook-specific statistics into global 
 * summary values. By centralizing this logic, we ensure that both the dashboard 
 * cards and detailed modal views use identical calculation heuristics, preventing 
 * mathematical drift across the UI.
 * * The file is designed to handle the `notebookStats` map structure, which contains 
 * cumulative study duration in seconds for both weekly and lifetime intervals. 
 * It performs defensive checks to ensure that missing or malformed data points 
 * default to zero, providing a robust "training wheel" for components that need 
 * to display aggregate totals without bloating their own internal logic with 
 * complex reduce operations or unit conversions.
 ***************************************************************************************/

import { NotebookStudyStats } from '@/app/Library/Definitions/StudyLogDefinitions';

/**
 * @function calculateTotalHoursFromStats
 * @description
 * Aggregates the study duration in seconds from a map of notebook statistics and 
 * converts the result into decimal hours. It accepts a period parameter to 
 * determine whether to sum the 'weekly' counters or the 'total' lifetime counters 
 * for each individual notebook entry.
 * * @param statsMap - A record where keys are notebook IDs and values are study stats objects.
 * @param period - The specific timeframe context: 'week' for the current week or 'alltime' for lifetime.
 * @returns {number} The total study time in hours, represented as a floating-point number.
 */
export function calculateTotalHoursFromStats(
  statsMap: Record<string, NotebookStudyStats>,
  period: 'week' | 'alltime'
): number {
  // 1. Extract the values from the statistics record to iterate over the notebook data.
  const entries = Object.values(statsMap || {});

  // 2. Perform a reduction to sum the appropriate duration based on the active period.
  const totalSeconds = entries.reduce((acc, stats) => {
    // If we are looking for weekly data, use 'weekly', otherwise use 'total' (all-time).
    const valueToAdd = period === 'week' ? (stats.weekly || 0) : (stats.total || 0);
    return acc + valueToAdd;
  }, 0);

  // 3. Convert the total accumulated seconds into hours (seconds / 3600).
  return totalSeconds / 3600;
}