/**
 * @class StorageManagerV2
 * @description Handles data persistence of version history and user preferences
 */
export class StorageManagerV2 {
  /**
   * Creates a StorageManagerV2 instance
   * @param {string} [localStorageKey='textVersionControlV2'] - Key for localStorage
   */
  constructor(localStorageKey = 'textVersionControlV2') {
    this._storageKey = localStorageKey;
  }

  /**
   * Saves user preferences (current branch and version)
   * @param {object} preferences - Object containing preferences to save
   */
  saveUserPreferences(preferences) {
    try {
      localStorage.setItem(`${this._storageKey}_prefs`, JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  /**
   * Loads user preferences from storage
   * @returns {object|null} - Loaded preferences or null if not found/error
   */
  loadUserPreferences() {
    try {
      // DEVELOPMENT ONLY: Return null for easier testing
      // In production, uncomment the code below:
      // const prefsString = localStorage.getItem(`${this._storageKey}_prefs`);
      // return prefsString ? JSON.parse(prefsString) : null;
      
      console.log('StorageManager: Returning null for development');
      return null;
    } catch (e) {
      console.error('Failed to load preferences:', e);
      return null;
    }
  }

  /**
   * Saves version history (all branches and versions)
   * @param {object} branchesData - Complete branches data object
   */
  saveHistory(branchesData) {
    try {
      localStorage.setItem(`${this._storageKey}_history`, JSON.stringify(branchesData));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  /**
   * Loads version history from storage
   * @returns {object|null} - Loaded branches data or null if not found/error
   */
  loadHistory() {
    try {
      // DEVELOPMENT ONLY: Return null for easier testing
      // In production, uncomment the code below:
      // const historyString = localStorage.getItem(`${this._storageKey}_history`);
      // return historyString ? JSON.parse(historyString) : null;
      
      console.log('StorageManager: Returning null for development');
      return null;
    } catch (e) {
      console.error('Failed to load history:', e);
      return null;
    }
  }
} 