/***********************************************************************************************
 * @file VersionHistoryPanel.tsx
 * @description
 *   Implements the left-hand Version History panel with two distinct modes: “History” (per-map
 *   snapshots) and “Deleted Maps” (one latest snapshot per deleted map).  It consumes
 *   VersionHistoryContext to:
 *     • Toggle panel visibility and fetch data via openHistory() or fetchDeletedSnapshots().
 *     • Render snapshot entries labeled with user-friendly map titles.
 *     • Preview live-history snapshots when clicking in “History” mode.
 *     • Restore deleted maps in “Deleted Maps” mode via restoreMap().
 *     • Maintain only local UI state for the active tab, avoiding overuse of context.
 *   All clickable actions emit console.log statements (7021–7023) with unique codes for
 *   debugging.  CSS styling is preserved; new classes (.vhp-tabs, .vhp-tab, .vhp-item-title,
 *   .vhp-restore-btn, .vhp-item-content) support the tab UI and restore button.
 *
 * Responsibilities:
 *   • Render a two-tab interface to switch between live history and deleted maps.
 *   • Display snapshot metadata—title, timestamp, author—and “Restore” where appropriate.
 *   • Wire up context calls for fetching, previewing, and restoring snapshots.
 *   • Log user interactions with clear four-digit codes for traceability.
 ***********************************************************************************************/

import React, { useState, useEffect, useMemo } from 'react';
import { useVersionHistory, SnapshotMeta } from '@/app/Library/Context/VersionHistoryContext';
import './VersionHistoryPanel.css';

const VersionHistoryPanel: React.FC = () => {
  const {
    isHistoryOpen,
    isListLoading,
    snapshots,
    selectedSnapshotId,
    isSnapshotLoading,
    openHistory,
    closeHistory,
    selectSnapshot,
    fetchDeletedSnapshots,
    restoreMap
  } = useVersionHistory();

  // Local UI state for which tab is active
  const [activeTab, setActiveTab] = useState<'live'|'deleted'>('live');

  // Whenever the panel opens or the tab changes, fetch the appropriate list
  useEffect(() => {
    if (!isHistoryOpen) return;
    if (activeTab === 'live') {
      openHistory();
    } else {
      fetchDeletedSnapshots();
    }
  }, [activeTab, isHistoryOpen, openHistory, fetchDeletedSnapshots]);

  if (!isHistoryOpen) return null;

  // Filter out the synthetic "__live__" entry in deleted mode
  const displaySnapshots: SnapshotMeta[] =
    activeTab === 'deleted'
      ? snapshots.filter(s => s.snapshotId !== '__live__')
      : snapshots;

  return (
    <aside className="version-history-panel">
      <header className="vhp-header">
        <h2>Version History</h2>
        <button
          className="vhp-close-btn"
          onClick={() => {
            console.log('VersionHistoryPanel.tsx 7021 › close clicked');
            closeHistory();
          }}
          aria-label="Close version history"
        >
          ×
        </button>
      </header>

      {/* Tabs */}
      <div className="vhp-tabs">
        <button
          className={`vhp-tab${activeTab === 'live' ? ' active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          History
        </button>
        <button
          className={`vhp-tab${activeTab === 'deleted' ? ' active' : ''}`}
          onClick={() => setActiveTab('deleted')}
        >
          Deleted Maps
        </button>
      </div>

      {/* Loading / Empty / List */}
      {isSnapshotLoading && <div className="vhp-loading">Loading snapshot preview…</div>}
      {isListLoading ? (
        <div className="vhp-loading">Loading snapshots…</div>
      ) : displaySnapshots.length === 0 ? (
        <div className="vhp-empty">No snapshots available.</div>
      ) : (
        <ul className="vhp-list">
          {displaySnapshots.map((s: SnapshotMeta) => (
            <li
              key={s.snapshotId}
              className={`vhp-item${
                activeTab === 'live' && selectedSnapshotId === s.snapshotId
                  ? ' selected'
                  : ''
              }`}
            >
              {/* Content Click Area */}
              <div
                className="vhp-item-content"
                onClick={() => {
                  if (activeTab === 'live') {
                    console.log('VersionHistoryPanel.tsx 7022 › history item clicked', s.snapshotId);
                    selectSnapshot(s.snapshotId);
                  }
                }}
              >
                <div className="vhp-item-title">{s.title}</div>
                <div className="vhp-item-ts">
                  {s.snapshotId === '__live__'
                    ? 'Current Version'
                    : new Date(s.ts).toLocaleString()}
                </div>
                <div className="vhp-item-author">{s.author}</div>
              </div>

              {/* Restore Button in Deleted-Maps Mode */}
              {activeTab === 'deleted' && (
                <button
                  className="vhp-restore-btn"
                  onClick={() => {
                    console.log('VersionHistoryPanel.tsx 7023 › restore clicked', s.snapshotId);
                    restoreMap(s);
                  }}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};

export default VersionHistoryPanel;
