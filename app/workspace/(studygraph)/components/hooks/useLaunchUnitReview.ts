/**

@file useLaunchUnitReview.ts

@description

This file implements the useLaunchUnitReview custom hook, which serves as the centralized logic controller
for initiating unit-wide review sessions within the BloomMap application. Its primary responsibility is
to provide a stable, reusable interface for different UI components—such as the concept map nodes,
the right-rail resource display cards, and the canvas header—to trigger assessment-focused slideshows.
By encapsulating the logic required to fetch the linear lesson order, filter out non-assessment content
(specifically lecture notes), and interface with the SlideShowContext, this hook ensures that the
"Start Review" action remains deterministic and maintainable. This architectural choice avoids
code duplication and ensures that any future changes to the review filtering criteria only
need to be applied in a single, well-documented location, preserving the integrity of the
learning-recall workflow across the entire studygraph workspace.
*/

import { useCallback } from 'react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useLessonUnitOrder } from '@/app/workspace/(studygraph)/components/hooks/useLessonUnitOrder';

/**

useLaunchUnitReview

@description

Custom hook that orchestrates the preparation and launch of a unit review session. It consumes

the current lesson's unit order and the unified SlideShow context to open a custom deck.

Time Complexity: O(N) where N is the number of slides in the lesson (due to the filter operation).
*/
export const useLaunchUnitReview = () => {
const { openCustom } = useSlideShow();
const unitOrderSlides = useLessonUnitOrder();

/**

launchReview

@description

Prepares the assessment slide deck by filtering for quizzes and cue cards, then triggers

the slideshow overlay using the 'review' cache type for persistence and resuming.
*/
const launchReview = useCallback(() => {
// 1. Step 1: Filter the lesson slides to include only cue cards and practice sheets (quizzes)
const assessmentSlides = unitOrderSlides.filter(card => card.type !== 'note');

// 2. Step 2: Log the functional shortcut interaction for observability
console.log('[useLaunchUnitReview] Initiating assessment-only deck', { 
  total: assessmentSlides.length 
});

// 3. Step 3: Launch the custom slideshow using the 'review' persistence key
// We pass true for resumeSlide to allow users to pick up where they left off in their review
openCustom(assessmentSlides, "review", true);
}, [unitOrderSlides, openCustom]);

return { launchReview };
};