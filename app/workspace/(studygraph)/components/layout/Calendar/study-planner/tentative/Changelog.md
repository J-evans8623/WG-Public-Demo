3. Documentation: CHANGELOG.md
Study Planner Algorithm Repair - Changelog
Problem Statement
The Study Planner experienced a regression regarding the update of existing notebooks (Case A).

Previous Behavior (Working): Updating an existing notebook with new lessons resulted in a dense schedule where the new lessons were appended immediately.

Recent Behavior (Broken): After adding functionality to support inserting new notebooks (Case B), updates to existing notebooks became sparse and unreliable.

Root Cause: The algorithm was refactored to support "Insertion" by using a Passive Dynamic Filter. This filter relies on iterating through days and checking if the current active set has work. When updating an existing notebook without resetting the schedule, the passive filter often skipped valid days because it lacked the Active Anchoring logic that forces the scheduler to find the specific "Next Available Slot" for that specific notebook.

Solution: Separation of Concerns
To resolve this without breaking the new "Insert" functionality, we implemented a Separation of Concerns pattern. The extendPlan method was split into two distinct strategies:

Insertion Strategy (for New Notebooks): Uses the passive filter + state reconfiguration.

Update Strategy (for Existing Notebooks): Restores the original active anchoring logic.

Code Review
1. Service Layer (StudyPlanService.ts)
We updated extendStudyPlan to accept a PlanUpdateType parameter. It now acts as a router:

TypeScript

if (updateType === 'InsertNotebook') {
    // 1. Reconfigure State (Reset momentum)
    // 2. Truncate Future Sessions
    // 3. Call extendPlan_InsertionStrategy
} else {
    // 1. Preserve State
    // 2. Call extendPlan_UpdateStrategy (The Fix)
}
2. Orchestrator Layer (StudyPlanOrchestrator.ts)
We refactored the class to expose two public extension methods:

extendPlan_InsertionStrategy: Contains the logic from the previous sprint. It is flexible and handles structural changes well by resetting the timeline.

extendPlan_UpdateStrategy: Restores the findNextEligibleLearningSetDay logic. It pre-calculates "Anchors" for every notebook with pending work. This forces the scheduler to create sessions on specific dates, ensuring that adding 3 lessons to a Biology notebook results in 3 specific study sessions, regardless of the current day's active set.

Verification
This solution satisfies the success criteria:

[x] Generating a new study plan works (Standard generatePlan).

[x] Updating existing books works (Routed to UpdateStrategy -> Active Anchoring).

[x] Inserting new books works (Routed to InsertionStrategy -> Passive Filter).