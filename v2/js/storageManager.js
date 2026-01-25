/**
 * @class StorageManager
 * @description Handles persistence of version history and user preferences.
 * Uses localStorage for automatic persistence and provides export/import for JSON files.
 */
export class StorageManager {
  /**
   * @private
   * @type {string} Key for storing branch data in localStorage
   */
  static STORAGE_KEY_BRANCHES = 'sapling_v2_branches';

  /**
   * @private
   * @type {string} Key for storing user preferences in localStorage
   */
  static STORAGE_KEY_PREFS = 'sapling_v2_preferences';

  constructor() {}

  /**
   * Saves all branches data to localStorage
   * @param {Object} branchesData - All branches data from VersionControl
   * @returns {boolean} Success status
   */
  saveBranches(branchesData) {
    try {
      const jsonData = JSON.stringify(branchesData);
      localStorage.setItem(StorageManager.STORAGE_KEY_BRANCHES, jsonData);
      return true;
    } catch (e) {
      console.error('Failed to save branches to localStorage:', e);
      return false;
    }
  }

  /**
   * Loads all branches data from localStorage
   * @returns {Object|null} Branches data or null if not found/invalid
   */
  loadBranches() {
    try {
      const jsonData = localStorage.getItem(StorageManager.STORAGE_KEY_BRANCHES);
      if (jsonData) {
        return JSON.parse(jsonData);
      }
    } catch (e) {
      console.error('Failed to load branches from localStorage:', e);
    }
    return null;
  }

  /**
   * Saves user preferences (current position) to localStorage
   * @param {string} branchId - Current branch ID
   * @param {number} transactionIndex - Current transaction index
   * @returns {boolean} Success status
   */
  saveUserPreferences(branchId, transactionIndex) {
    try {
      const prefs = {
        currentBranchId: branchId,
        currentTransactionIndex: transactionIndex
      };
      const jsonData = JSON.stringify(prefs);
      localStorage.setItem(StorageManager.STORAGE_KEY_PREFS, jsonData);
      return true;
    } catch (e) {
      console.error('Failed to save user preferences to localStorage:', e);
      return false;
    }
  }

  /**
   * Loads user preferences from localStorage
   * @returns {{currentBranchId: string, currentTransactionIndex: number}|null}
   */
  loadUserPreferences() {
    try {
      const jsonData = localStorage.getItem(StorageManager.STORAGE_KEY_PREFS);
      if (jsonData) {
        return JSON.parse(jsonData);
      }
    } catch (e) {
      console.error('Failed to load user preferences from localStorage:', e);
    }
    return null;
  }

  /**
   * Exports version history to a downloadable JSON file
   * @param {Object} branchesData - All branches data to export
   */
  exportHistory(branchesData) {
    try {
      const jsonData = JSON.stringify(branchesData, null, 2); // Pretty print
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `sapling-history-${dateStr}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('History exported successfully');
    } catch (e) {
      console.error('Failed to export history:', e);
      alert('Error exporting history. See console for details.');
    }
  }

  /**
   * Imports version history from a JSON string
   * @param {string} jsonData - JSON string containing branches data
   * @returns {Object|null} Parsed branches data or null on error
   */
  importHistory(jsonData) {
    try {
      const branchesData = JSON.parse(jsonData);

      // Basic validation
      if (typeof branchesData !== 'object' || branchesData === null) {
        throw new Error('Invalid data structure: expected object');
      }

      // Validate that it looks like v2 format (has branches with transactions)
      const hasValidBranches = Object.values(branchesData).every(branch => {
        return branch &&
               typeof branch === 'object' &&
               Array.isArray(branch.transactions) &&
               typeof branch.initialContent === 'string';
      });

      if (!hasValidBranches) {
        throw new Error('Invalid data structure: branches missing required fields');
      }

      console.log('History imported successfully');
      return branchesData;
    } catch (e) {
      console.error('Failed to import history:', e);
      alert('Invalid history file. Please check the file format.');
      return null;
    }
  }

  /**
   * Clears all stored data (for testing/reset purposes)
   */
  clearAllData() {
    try {
      localStorage.removeItem(StorageManager.STORAGE_KEY_BRANCHES);
      localStorage.removeItem(StorageManager.STORAGE_KEY_PREFS);
      console.log('All stored data cleared');
    } catch (e) {
      console.error('Failed to clear stored data:', e);
    }
  }
}
