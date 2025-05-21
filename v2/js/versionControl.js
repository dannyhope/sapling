import { VersionContentStore } from './versionContentStore.js';

/**
 * @class VersionControlV2
 * @description Core version control system that manages text content history
 */
export class VersionControlV2 {
  /**
   * Creates a VersionControlV2 instance
   * @param {EditorManagerV2} editorManager - Editor manager instance
   * @param {TimelineManagerV2} timelineManager - Timeline manager instance
   * @param {StorageManagerV2} storageManager - Storage manager instance
   * @param {UIManagerV2} uiManager - UI manager instance
   */
  constructor(editorManager, timelineManager, storageManager, uiManager) {
    this.editorManager = editorManager;
    this.timelineManager = timelineManager;
    this.storageManager = storageManager;
    this.uiManager = uiManager;

    /**
     * @private
     * @type {object} Stores all branches with their versions
     */
    this._branches = {};
    
    /** @private @type {string} Currently active branch ID */
    this._currentBranchId = '';
    
    /** @private @type {string} Currently active version ID */
    this._currentVersionId = '';
    
    /** @private @type {Array} Version history for undo/redo operations */
    this._versionHistory = [];
    
    /** @private @type {number} Current position in version history */
    this._historyPosition = -1;
  }

  /**
   * Initialize version control system
   */
  init() {
    const loadedHistory = this.storageManager.loadHistory();
    const loadedPrefs = this.storageManager.loadUserPreferences();

    if (loadedHistory) {
      this._loadHistoryAndPreferences(loadedHistory, loadedPrefs);
    } else {
      this._createDefaultMainBranch();
    }

    this._updateEditorContent();
    this._updateUI();
    this._saveAllData();
  }
  
  /**
   * Load history and user preferences
   * @private
   * @param {object} history - Loaded history data
   * @param {object} prefs - Loaded preferences
   */
  _loadHistoryAndPreferences(history, prefs) {
    this._branches = history;
    
    if (prefs && this._branchExists(prefs.currentBranchId) && 
        this._versionExists(prefs.currentBranchId, prefs.currentVersionId)) {
      this._currentBranchId = prefs.currentBranchId;
      this._currentVersionId = prefs.currentVersionId;
    } else {
      // Fallback to main branch
      this._currentBranchId = 'main';
      const mainBranch = this._branches['main'];
      if (mainBranch && mainBranch.versions.length > 0) {
        this._currentVersionId = mainBranch.versions[mainBranch.versions.length - 1].id;
      } else {
        this._createDefaultMainBranch();
      }
    }
  }
  
  /**
   * Check if branch exists
   * @private
   * @param {string} branchId - Branch ID to check
   * @returns {boolean} Whether branch exists
   */
  _branchExists(branchId) {
    return !!this._branches[branchId];
  }
  
  /**
   * Check if version exists in branch
   * @private
   * @param {string} branchId - Branch ID
   * @param {string} versionId - Version ID
   * @returns {boolean} Whether version exists
   */
  _versionExists(branchId, versionId) {
    const branch = this._branches[branchId];
    return branch && branch.versions.some(v => v.id === versionId);
  }
  
  /**
   * Update editor with current version content
   * @private
   */
  _updateEditorContent() {
    const currentVersion = this.getCurrentVersion();
    if (currentVersion && currentVersion.sparseContent) {
      const store = new VersionContentStore(currentVersion.sparseContent);
      const text = store.getCurrentText();
      this.editorManager.setValue(text, true);
      this.editorManager.updatePreviousContent(text);
    } else {
      console.error("Failed to get current version data");
      this.editorManager.setValue("", true);
      this.editorManager.updatePreviousContent("");
    }
  }
  
  /**
   * Update UI elements
   * @private
   */
  _updateUI() {
    if (this.timelineManager) {
      this.timelineManager.render();
    }
    
    if (this.uiManager) {
      this.uiManager.updateVersionInfo();
    }
  }

  /**
   * Create default main branch
   * @private
   */
  _createDefaultMainBranch() {
    const initialVersionId = this._generateId();
    this._branches.main = {
      versions: [{ 
        id: initialVersionId, 
        sparseContent: [], 
        timestamp: Date.now(), 
        type: 'initial', 
        message: 'Initial empty content' 
      }],
      parent: null
    };
    this._currentBranchId = 'main';
    this._currentVersionId = initialVersionId;
  }

  /**
   * Generate a unique ID
   * @private
   * @returns {string} Unique ID
   */
  _generateId() {
    return `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Finds the branch ID that a given version ID belongs to.
   * @param {string} versionId - The ID of the version to find.
   * @returns {string|null} The ID of the branch, or null if not found.
   */
  findBranchOfVersion(versionId) {
    for (const branchId in this._branches) {
      const branch = this._branches[branchId];
      if (branch.versions && branch.versions.some(v => v.id === versionId)) {
        return branchId;
      }
    }
    console.warn(`Branch not found for version ID: ${versionId}`);
    return null;
  }

  /**
   * Record a character typing action
   * @param {number} index - Index where character was typed
   * @param {string} char - Character typed
   * @param {string} [message] - Optional message
   */
  recordCharacterTyped(index, char, message) {
    const currentVersionObject = this.getCurrentVersion();
    if (!currentVersionObject) {
      console.error("Cannot find current version for typing");
      return;
    }

    const currentBranchVersions = this._branches[this._currentBranchId]?.versions || [];
    const isAtTipOfBranch = currentBranchVersions.length === 0 || currentBranchVersions[currentBranchVersions.length - 1].id === this._currentVersionId;

    let baseSparseContent;
    let newBranchParentInfo = null;

    if (!isAtTipOfBranch && currentBranchVersions.length > 0) {
      // Branching: Start with clean sparseContent from visible text
      const tempStore = new VersionContentStore(currentVersionObject.sparseContent);
      const visibleTextAtFork = tempStore.getCurrentText();
      baseSparseContent = VersionContentStore.sparseContentFromText(visibleTextAtFork);
      newBranchParentInfo = {
        branchId: this._currentBranchId,
        versionId: this._currentVersionId
      };
    } else {
      // Not branching or on an empty branch: Use current version's sparseContent
      baseSparseContent = currentVersionObject.sparseContent || [];
    }

    const workingStore = new VersionContentStore(baseSparseContent);
    workingStore.typeChar(index, char);
    const finalSparseContent = workingStore.getSparseContent();

    this._commitVersion('charTyped', finalSparseContent,
      message || `Typed '${char}' at index ${index}`,
      newBranchParentInfo);
  }

  /**
   * Record a character deletion action
   * @param {number} index - Index of deleted character
   * @param {string} [message] - Optional message
   */
  recordCharacterDeletion(index, message) {
    const currentVersionObject = this.getCurrentVersion();
    if (!currentVersionObject) {
      console.error("Cannot find current version for deletion");
      return;
    }
    
    const currentBranchVersions = this._branches[this._currentBranchId]?.versions || [];
    const isAtTipOfBranch = currentBranchVersions.length === 0 || currentBranchVersions[currentBranchVersions.length - 1].id === this._currentVersionId;

    let baseSparseContent;
    let newBranchParentInfo = null;

    if (!isAtTipOfBranch && currentBranchVersions.length > 0) {
      // Branching: Start with clean sparseContent from visible text
      const tempStore = new VersionContentStore(currentVersionObject.sparseContent);
      const visibleTextAtFork = tempStore.getCurrentText();
      baseSparseContent = VersionContentStore.sparseContentFromText(visibleTextAtFork);
      newBranchParentInfo = {
        branchId: this._currentBranchId,
        versionId: this._currentVersionId
      };
    } else {
      // Not branching: Use current version's sparseContent
      baseSparseContent = currentVersionObject.sparseContent || [];
    }

    const workingStore = new VersionContentStore(baseSparseContent);
    workingStore.deleteChar(index);
    const finalSparseContent = workingStore.getSparseContent();
    
    this._commitVersion('charDeleted', finalSparseContent,
      message || `Deleted character at index ${index}`,
      newBranchParentInfo);
  }
  
  /**
   * Get or create current branch
   * @private
   * @returns {object} Current branch
   */
  _getOrCreateCurrentBranch() {
    if (!this._branches[this._currentBranchId]) {
      console.warn(`Current branch '${this._currentBranchId}' not found during getOrCreate, falling back to main or creating default.`);
      // Attempt to find if _currentVersionId exists on *any* branch, if so, switch to it.
      // This is a recovery mechanism, should ideally not be hit if state is managed well.
      let foundBranchForCurrentVersion = null;
      if (this._currentVersionId) {
        for (const branchId in this._branches) {
          if (this._branches[branchId].versions.some(v => v.id === this._currentVersionId)) {
            foundBranchForCurrentVersion = branchId;
            break;
          }
        }
      }

      if (foundBranchForCurrentVersion) {
        this._currentBranchId = foundBranchForCurrentVersion;
      } else if (this._branches.main) {
        this._currentBranchId = 'main';
        // If main has versions, set current version to the last one.
        if (this._branches.main.versions.length > 0) {
          this._currentVersionId = this._branches.main.versions[this._branches.main.versions.length -1].id;
        } else {
          // Main exists but is empty, treat as needing default init for main.
          this._createDefaultMainBranch(); // This will also set current version id
        }
      } else {
        this._createDefaultMainBranch();
      }
    }
    return this._branches[this._currentBranchId];
  }
  
  /**
   * Commits a new version with the given details.
   * Handles new branch creation if newBranchParentInfo is provided.
   * @private
   * @param {string} type - Version type
   * @param {Array} sparseContent - Final sparseContent for this version
   * @param {string} message - Version message
   * @param {object|null} newBranchParentInfo - If not null, indicates a new branch should be created.
   *                                            Contains {branchId, versionId} of the parent.
   */
  _commitVersion(type, sparseContent, message, newBranchParentInfo) {
    let targetBranchId = this._currentBranchId;
    let targetBranchObject;

    if (newBranchParentInfo) {
      const newBranchName = `branch-id-${Date.now().toString().slice(-5)}-${Math.random().toString(36).substring(2, 7)}`;
      this._branches[newBranchName] = {
        versions: [],
        parent: newBranchParentInfo // { branchId: parentBranchId, versionId: parentVersionId }
      };
      targetBranchId = newBranchName;
      this._currentBranchId = newBranchName; // Switch context to the new branch
      // message = `(Branched from ${newBranchParentInfo.branchId.substring(0,6)}...) ${message}`; // Optional: Modify message
    }
    
    targetBranchObject = this._getOrCreateCurrentBranch(); // Ensures branch exists

    const newVersionId = this._generateId();
    const newVersion = {
      id: newVersionId,
      sparseContent,
      timestamp: Date.now(),
      type,
      message
    };

    targetBranchObject.versions.push(newVersion);
    this._currentVersionId = newVersionId;
    
    const store = new VersionContentStore(sparseContent);
    this.editorManager.updatePreviousContent(store.getCurrentText());
    
    this._updateUI();
    this._saveAllData();
  }
  
  /**
   * Create a new branch from current version
   * This is for explicit "Create Branch" button, not automatic branching.
   * @param {string} branchName - Name of new branch
   * @returns {boolean} Success status
   */
  createBranch(branchName) {
    if (!branchName || this._branches[branchName]) {
      this.uiManager.displayMessage(`Branch name "${branchName}" is invalid or already exists.`, 'error');
      return false;
    }
    
    const currentVersion = this.getCurrentVersion();
    if (!currentVersion) {
      this.uiManager.displayMessage('Cannot create branch: No current version to branch from.', 'error');
      return false;
    }
    
    // For explicit branch creation, we base the new branch's first version
    // on the *current* state (which might be historical if user scrubbed back).
    // We take a "clean" snapshot of the visible text for the new branch's first version.
    const tempStore = new VersionContentStore(currentVersion.sparseContent);
    const visibleTextAtFork = tempStore.getCurrentText();
    const cleanSparseContentForNewBranch = VersionContentStore.sparseContentFromText(visibleTextAtFork);

    const newVersionId = this._generateId();
    this._branches[branchName] = {
      versions: [{
        id: newVersionId,
        sparseContent: cleanSparseContentForNewBranch, // Use the cleaned sparse content
        timestamp: Date.now(),
        type: 'branch_created', // A more specific type for this action
        message: `Created branch '${branchName}' from ${this._currentBranchId}:${this._currentVersionId.substring(0, 8)}`
      }],
      parent: {
        branchId: this._currentBranchId,
        versionId: this._currentVersionId
      }
    };
    
    // Switch to new branch and its first version
    this._currentBranchId = branchName;
    this._currentVersionId = newVersionId;
    
    this._updateEditorContent(); // Ensure editor reflects the state of the new branch's first version
    this._updateUI();
    this._saveAllData();
    this.uiManager.displayMessage(`Branch "${branchName}" created and switched to.`, 'success');
    return true;
  }
  
  /**
   * Switch to a specific version
   * @param {string} branchId - Branch ID
   * @param {string} versionId - Version ID
   * @returns {boolean} Success status
   */
  switchToVersion(branchId, versionId) {
    if (!this._branchExists(branchId) || !this._versionExists(branchId, versionId)) {
      return false;
    }
    
    this._currentBranchId = branchId;
    this._currentVersionId = versionId;
    
    this._updateEditorContent();
    this._updateUI();
    this._saveUserPreferences();
    
    return true;
  }
  
  /**
   * Undo the last change
   * @returns {boolean} Success status
   */
  undo() {
    const currentBranch = this._branches[this._currentBranchId];
    if (!currentBranch || currentBranch.versions.length <= 1) {
      return false; // Can't undo initial version
    }
    
    const currentIndex = currentBranch.versions.findIndex(v => v.id === this._currentVersionId);
    if (currentIndex <= 0) {
      return false; // Already at initial version
    }
    
    this._currentVersionId = currentBranch.versions[currentIndex - 1].id;
    
    this._updateEditorContent();
    this._updateUI();
    this._saveUserPreferences();
    
    return true;
  }
  
  /**
   * Redo a previously undone change
   * @returns {boolean} Success status
   */
  redo() {
    const currentBranch = this._branches[this._currentBranchId];
    if (!currentBranch) {
      return false;
    }
    
    const currentIndex = currentBranch.versions.findIndex(v => v.id === this._currentVersionId);
    if (currentIndex === -1 || currentIndex >= currentBranch.versions.length - 1) {
      return false; // Already at newest version
    }
    
    this._currentVersionId = currentBranch.versions[currentIndex + 1].id;
    
    this._updateEditorContent();
    this._updateUI();
    this._saveUserPreferences();
    
    return true;
  }

  /**
   * Get data for a specific branch
   * @param {string} branchId - Branch ID
   * @returns {object} Branch data or undefined if not found
   */
  getBranchData(branchId) {
    return this._branches[branchId];
  }

  /**
   * Get all branches data
   * @returns {object} All branches data
   */
  getAllBranchesData() {
    return this._branches;
  }

  /**
   * Get current version object
   * @returns {object|null} Current version or null if not found
   */
  getCurrentVersion() {
    const branch = this._branches[this._currentBranchId];
    if (branch && branch.versions) {
      return branch.versions.find(v => v.id === this._currentVersionId) || null;
    }
    return null;
  }
  
  /**
   * Load all branches data
   * @param {object} branchesData - Branches data to load
   * @returns {boolean} Success status
   */
  loadAllBranchesData(branchesData) {
    if (!branchesData || typeof branchesData !== 'object') {
      return false;
    }
    
    this._branches = branchesData;
    
    // Set current branch and version to main branch tip
    if (this._branches.main && this._branches.main.versions.length > 0) {
      this._currentBranchId = 'main';
      this._currentVersionId = this._branches.main.versions[this._branches.main.versions.length - 1].id;
    } else {
      this._createDefaultMainBranch();
    }
    
    this._updateEditorContent();
    this._updateUI();
    this._saveAllData();
    
    return true;
  }

  /**
   * Save user preferences
   * @private
   */
  _saveUserPreferences() {
    if (!this.storageManager) return;
    
    this.storageManager.saveUserPreferences({
      currentBranchId: this._currentBranchId,
      currentVersionId: this._currentVersionId
    });
  }

  /**
   * Save version history
   * @private
   */
  _saveHistory() {
    if (!this.storageManager) return;
    
    this.storageManager.saveHistory(this._branches);
  }

  /**
   * Save all data (history and preferences)
   * @private
   */
  _saveAllData() {
    this._saveHistory();
    this._saveUserPreferences();
  }
} 