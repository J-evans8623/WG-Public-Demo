/**
 * @file AssessmentSettingsForm.tsx
 * @description
 * This component is a standalone administrative utility designed to manage the update lifecycle of assessment metadata.
 * It has been updated for Phase 3 to solve the "Stale UI" bug by implementing a Dual-Sync strategy. 
 * The component is responsible for persisting changes to the Gradebook BFF and transactionally updating the 
 * collaborative ResourceCard in the Y.Doc. By consuming ResourceContext, it ensures that changes to 
 * availability windows and attempt limits are propagated in real-time to all collaborators and 
 * correctly reflected in the AssessmentTab list. It maintains strict isolation via localized 12-hour 
 * picker states and maps them back to UTC ISO strings for server authority.
 * * update - 10.1: Integrated ResourceContext to perform deep card updates in the Y.Doc registry.
 * update - 10.2: Implemented handleSave logic to await collaborative persistence and trigger UI revalidation.
 */

import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, RotateCcw } from 'lucide-react';
import { useApiContext } from '@/app/src/context/ApiContext';
import { useGradebook } from '@/app/Library/hooks/useGradebook';
import { useResourceContext } from '@/app/Library/Context/ResourceContext'; // update - 10.1
import './AssessmentSettingsForm.css';

interface AssessmentSettingsFormProps {
  docId: string;
  assignmentId: string;
  initialTitle: string;
  initialStart: string; // ISO String
  initialEnd: string;   // ISO String
  initialLimit: number;
  onClose: () => void;
}

/**
 * parseIsoToDateTime
 * @description
 * Decomposes a UTC ISO string into localized date and 12-hour components. O(1).
 */
const parseIsoToDateTime = (iso: string) => {
  const d = new Date(iso);
  const datePart = d.toISOString().split('T')[0];
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return { date: datePart, hour: String(hours).padStart(2, '0'), minute: minutes, period };
};

const AssessmentSettingsForm: React.FC<AssessmentSettingsFormProps> = ({
  docId,
  assignmentId,
  initialTitle,
  initialStart,
  initialEnd,
  initialLimit,
  onClose,
}) => {
  const { assignMetaPatch } = useApiContext();
  const { upsertAssignmentMeta } = useGradebook(docId);
  // update - 10.1: Consume Resource tools for collaborative sync.
  const { getQuizAssessmentById, editResourcev1, triggerQuizUpdate } = useResourceContext();

  const startParts = useMemo(() => parseIsoToDateTime(initialStart), [initialStart]);
  const endParts = useMemo(() => parseIsoToDateTime(initialEnd), [initialEnd]);

  const [title, setTitle] = useState(initialTitle);
  const [startDate, setStartDate] = useState(startParts.date);
  const [startTime, setStartTime] = useState({ hour: startParts.hour, minute: startParts.minute, period: startParts.period });
  const [endDate, setEndDate] = useState(endParts.date);
  const [endTime, setEndTime] = useState({ hour: endParts.hour, minute: endParts.minute, period: endParts.period });
  const [limit, setLimit] = useState(initialLimit);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * constructIso
   * @description
   * Maps localized UI state back to a UTC ISO string for persistence. O(1).
   */
  const constructIso = (dateStr: string, time: { hour: string; minute: string; period: string }) => {
    let h = parseInt(time.hour);
    if (time.period === 'PM' && h < 12) h += 12;
    if (time.period === 'AM' && h === 12) h = 0;
    const d = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${time.minute}:00`);
    return d.toISOString();
  };

  /**
   * handleSave
   * @description
   * Orchestrates the final update lifecycle. It transactionally patches the BFF, 
   * updates the local Gradebook cache, and deep-patches the collaborative Yjs card. 
   * Calling triggerQuizUpdate ensures the AssessmentTab re-renders immediately.
   * * update - 10.2
   */
  const handleSave = async () => {
    // 1. Initialize saving state and validate chronological logic.
    setIsSaving(true);
    setError(null);

    const startIso = constructIso(startDate, startTime);
    const endIso = constructIso(endDate, endTime);

    if (new Date(endIso) <= new Date(startIso)) {
      setError("Logical Error: Closing window must be after the opening time.");
      setIsSaving(false);
      return;
    }

    try {
      // 2. Step 1: Commit the partial update to the server persistence layer.
      const res = await assignMetaPatch({
        docId,
        assignmentId,
        title,
        startAt: startIso,
        endAt: endIso,
        attemptLimit: limit,
      });

      // 3. Step 2: Update the local Gradebook cache for consistent Gradebook modal views.
      upsertAssignmentMeta({
        assignmentId,
        title: res.saved.title,
        startAt: res.saved.startAt,
        endAt: res.saved.endAt,
        attemptLimit: res.saved.attemptLimit,
      });

      // 4. Step 3: Collaborative Sync. Resolve the Yjs card and patch its collaborative data.
      const originalCard = getQuizAssessmentById(assignmentId);
      if (originalCard) {
        // Create a deep clone and apply modifications to the ResourceCard.
        const updatedCard = {
          ...originalCard,
          title: res.saved.title,
          window: { startAt: res.saved.startAt, endAt: res.saved.endAt },
          attemptLimit: res.saved.attemptLimit,
        };
        // Commit the deep update to the Yjs Map via record().
        await editResourcev1(updatedCard);
      }

      // 5. Final Step: Signal the AssessmentTab to recalculate temporal chips and re-sort.
      triggerQuizUpdate();

      console.log('[6302] Metadata patched & Yjs card synchronized successfully.');
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save changes. Verify Document Ownership.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay asf-overlay" role="dialog" aria-modal="true" aria-labelledby="asf-title">
      <div className="modal-container asf-container">
        <div className="asf-header">
          <div className="asf-header-titles">
            <h2 id="asf-title" className="asf-title">Assignment Settings</h2>
            <span className="asf-subtitle">Modify availability window and attempt limits for students.</span>
          </div>
          <button className="asf-close-btn" onClick={onClose} aria-label="Close" title="Discard changes"><X size={20} /></button>
        </div>

        <div className="asf-body">
          <div className="asf-input-group">
            <label className="asf-label">Quiz Title</label>
            <input 
              className="asf-text-input" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. Midterm Assessment"
            />
          </div>

          <div className="asf-grid">
            <div className="asf-section">
              <div className="asf-section-header">
                <Calendar size={14} aria-hidden="true" /> <span>Opening Window</span>
              </div>
              <input type="date" className="asf-date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <div className="asf-time-picker">
                <select value={startTime.hour} aria-label="Opening Hour" onChange={(e) => setStartTime({...startTime, hour: e.target.value})}>
                  {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span>:</span>
                <select value={startTime.minute} aria-label="Opening Minute" onChange={(e) => setStartTime({...startTime, minute: e.target.value})}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="asf-period" aria-label="Opening Period" value={startTime.period} onChange={(e) => setStartTime({...startTime, period: e.target.value})}>
                  <option value="AM">AM</option><option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div className="asf-section">
              <div className="asf-section-header">
                <Clock size={14} aria-hidden="true" /> <span>Closing Window</span>
              </div>
              <input type="date" className="asf-date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <div className="asf-time-picker">
                <select value={endTime.hour} aria-label="Closing Hour" onChange={(e) => setEndTime({...endTime, hour: e.target.value})}>
                  {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span>:</span>
                <select value={endTime.minute} aria-label="Closing Minute" onChange={(e) => setEndTime({...endTime, minute: e.target.value})}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="asf-period" aria-label="Closing Period" value={endTime.period} onChange={(e) => setEndTime({...endTime, period: e.target.value})}>
                  <option value="AM">AM</option><option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="asf-input-group asf-limit-group">
            <div className="asf-label-row">
              <label className="asf-label">Attempt Limit</label>
              <span className="asf-hint">Originally set to: {initialLimit}</span>
            </div>
            <div className="asf-limit-control">
               <RotateCcw size={16} className="asf-icon-muted" aria-hidden="true" />
               <input 
                 type="number" 
                 min="1" 
                 className="asf-number-input" 
                 value={limit} 
                 onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))} 
               />
               <span className="asf-hint">students can retake up to this many times.</span>
            </div>
          </div>

          {error && <div className="asf-error-bar" role="alert">{error}</div>}
        </div>

        <div className="asf-footer">
          <button className="asf-btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="asf-btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentSettingsForm;