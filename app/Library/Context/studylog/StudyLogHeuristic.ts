/**
 * @file app/src/services/study-log/StudyLogHeuristics.ts
 * @description
 * Provides algorithms to estimate the "Maximum Reasonable Time" a user should spend on
 * a specific study resource. This is used to passively filter out AFK (Away From Keyboard)
 * time without requiring intrusive "Are you still there?" popups.
 *
 * Logic:
 * 1. Note Cards / Cue Cards: Based on word count (avg reading speed 150 wpm) + 30s buffer.
 * 2. Quizzes: Based on question count (2 mins per question).
 * 3. Default: Fallback buffer (2 mins) for unknown types or empty content.
 *
 * Bounds:
 * - Minimum valid time: 5 seconds (filter accidental clicks) - enforced by `isSignificantDuration`
 * - Absolute Maximum: 15 minutes (hard cap per slide)
 */

const WORDS_PER_MINUTE = 80;
const SECONDS_PER_QUESTION = 120; // 2 minutes
const ABSOLUTE_MAX_SECONDS = 15 * 60; // 15 minutes
const DEFAULT_BUFFER_SECONDS = 120; // 2 minutes fallback
const TEXT_BUFFER_SECONDS = 30; // Extra time for processing text

/**
 * @function calculateMaxStudyTime
 * @description
 * Calculates the upper bound of valid study time for a given resource.
 * The actual logged time will be `Math.min(actualDuration, maxStudyTime)`.
 *
 * @param type - The resource type ('note', 'cueCard', 'practiceSheet', etc.)
 * @param content - The content string or object.
 * @returns {number} The maximum allowable seconds for this slide.
 */
export function calculateMaxStudyTime(type: string, content: any): number {
  let estimatedSeconds = DEFAULT_BUFFER_SECONDS;

  try {
    if (!content) {
      return estimatedSeconds;
    }

    // 1. Text-based resources (Notes, Cue Cards)
    if (type === 'note' || type === 'cueCard') {
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      // Simple word count splitting by whitespace
      const wordCount = text.trim().split(/\s+/).length;
      
      // Formula: (Words / WPM) * 60 + Buffer
      const readingSeconds = (wordCount / WORDS_PER_MINUTE) * 60;
      estimatedSeconds = Math.ceil(readingSeconds + TEXT_BUFFER_SECONDS);
    } 
    
    // 2. Quiz-based resources (Practice Sheet, Quiz Assessment)
    else if (type === 'practiceSheet' || type === 'quizAssessment') {
      let questionCount = 1; // Default to at least 1 question
      
      if (Array.isArray(content)) {
        questionCount = content.length;
      } else if (typeof content === 'string') {
        // Attempt to parse if it's a JSON string
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            questionCount = parsed.length;
          } else if (parsed && typeof parsed === 'object') {
            // Some quiz structures might be nested
            questionCount = Object.keys(parsed).length || 1;
          }
        } catch (e) {
          // If parsing fails, assume it's a complex object or single block -> default to 1
          // fallback is already handled by initialization
        }
      }

      // Formula: Questions * 2 minutes
      estimatedSeconds = questionCount * SECONDS_PER_QUESTION;
    }

  } catch (error) {
    console.warn('[StudyLogHeuristics] Error calculating max time, using default', error);
    return DEFAULT_BUFFER_SECONDS;
  }

  // Enforce the Hard Cap (15 minutes)
  return Math.min(estimatedSeconds, ABSOLUTE_MAX_SECONDS);
}

/**
 * @function isSignificantDuration
 * @description
 * Determines if a duration is long enough to count as a valid study interaction.
 * Filters out "accidental clicks" or rapid skipping (less than 5 seconds).
 *
 * @param seconds - The actual elapsed time.
 * @returns {boolean} True if the duration should be logged.
 */
export function isSignificantDuration(seconds: number): boolean {
  return seconds >= 5;
}