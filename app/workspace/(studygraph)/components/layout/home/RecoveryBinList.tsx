/**
 * @file RecoveryBinList.tsx
 * @description 
 * This standalone React component serves as the primary user interface for the notebook recovery system. 
 * It is responsible for fetching, filtering, and displaying notebooks that have been soft-deleted and 
 * are currently residing in the 'recoveryBin' collection. Following the Interface Segregation Principle, 
 * this component isolates the logic for archival management from the main active file grid, preventing 
 * unnecessary bloat in the primary dashboard code. It implements a local search mechanism for high-performance 
 * filtering (O(N)) and provides a clear visual countdown for each notebook, indicating the specific 
 * number of days remaining before the automated retention janitor performs a hard-delete. By providing 
 * direct integration with the ApiContext's restoration methods, it enables users to seamlessly 
 * reinstate their documents, student grades, and associated instructional assets with a single click.
 * (152 words)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApiContext } from '@/app/src/context/ApiContext';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { RotateCcw, Search, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * @function calculateDaysRemaining
 * @description 
 * Computes the integer difference between the current date and the document's expiration timestamp. 
 * This utility ensures the UI provides an accurate, user-friendly countdown, allowing the educator 
 * to prioritize the restoration of critical files before they exceed the 30-day retention threshold.
 */
const calculateDaysRemaining = (expiresAt?: string): number => {
  if (!expiresAt) return 0;
  const now = new Date();
  const exp = new Date(expiresAt);
  const diffTime = exp.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

/**
 * @function RecoveryBinList
 * @description 
 * Orchestrates the rendering of binned notebooks. It manages local states for loading, search input, 
 * and the retrieved metadata array. It leverages the ApiContext to perform non-cached fetches 
 * of the bin contents and coordinates the transition of notebooks back to an active state.
 */
const RecoveryBinList: React.FC = () => {
  // 1. Initialize context and local state
  const { listRecoverableFiles, restoreFile } = useApiContext();
  const [binnedFiles, setBinnedFiles] = useState<UserFileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 2. Fetch the current state of the recovery bin on mount
  useEffect(() => {
    const fetchBin = async () => {
      try {
        const files = await listRecoverableFiles();
        setBinnedFiles(files);
      } catch (err) {
        console.error('[RecoveryBinList] Failed to load bin:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBin();
  }, [listRecoverableFiles]);

  // 3. Implement high-performance local filtering for the search bar
  const filteredFiles = useMemo(() => {
    return binnedFiles.filter(f => 
      f.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [binnedFiles, searchQuery]);

  /**
   * @function handleRestoreAction
   * @description 
   * Triggers the restoration process for a specific notebook. It provides immediate UI feedback 
   * via toasts and updates the local list to remove the restored item, ensuring the 
   * interface remains consistent with the backend state during the transition.
   */
  const handleRestoreAction = async (docId: string, fileName: string) => {
    try {
      await restoreFile(docId);
      setBinnedFiles(prev => prev.filter(f => f.fileId !== docId));
      toast.success(`Successfully restored "${fileName}"`);
    } catch (err) {
      toast.error('Failed to restore notebook');
    }
  };

  if (loading) {
    return <div className="loading-spinner">Loading Recovery Bin...</div>;
  }

  return (
    <div className="recovery-bin-container">
      {/* 4. Sub-header with search specific to binned items */}
      <div className="files-header-top" style={{ marginBottom: '16px' }}>
        <div className="files-search">
          <input
            type="text"
            className="files-search-input"
            placeholder="Search deleted notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 5. Conditional rendering for empty bin state */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗑️</div>
          <h3 className="empty-title">Recovery Bin is Empty</h3>
          <p className="empty-description">Notebooks you delete will stay here for 30 days before permanent removal.</p>
        </div>
      ) : (
        <div className="files-grid">
          {filteredFiles.map((file) => {
            const daysLeft = calculateDaysRemaining((file as any).expiresAt);
            return (
              <div key={file.fileId} className="file-tile bin-item" style={{ '--accent-color': '#e5e7eb' } as any}>
                <div className="file-header-row">
                  <div className="file-icon-small"><BookOpen size={16} /></div>
                  <div className="file-title">{file.fileName}</div>
                </div>
                
                <div className="file-footer">
                  <div className="file-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626' }}>
                    <Clock size={12} />
                    <span className="file-time">{daysLeft} days until deletion</span>
                  </div>
                </div>

                {/* 6. Restoration Action Button */}
                <button 
                  className="restore-button-overlay"
                  onClick={() => handleRestoreAction(file.fileId, file.fileName)}
                  title="Restore Notebook"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecoveryBinList;