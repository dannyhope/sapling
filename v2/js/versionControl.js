import { VersionContentStore } from './versionContentStore.js';

// Constants for Version Control
const DEFAULT_BRANCH_ID = 'main';
const INITIAL_TRANSACTION_INDEX = -1;
const OP_TYPE_ADD = 'charTyped';
const OP_TYPE_DELETE = 'charDeleted'; // Single character deletion
const OP_TYPE_DELETE_MULTI = 'charsDeleted'; // Multiple character deletion
const OP_TYPE_INITIAL = 'initial';
const OP_TYPE_BRANCH_CREATED = 'branch_created';
const OP_TYPE_UNKNOWN = 'unknown_op';
const BRANCH_ID_AUTOMATIC_PREFIX = 'branch-';

/**
 * @class VersionControl
 * @description Core version control system that manages text content history
 */
export class VersionControl {
  /**
   * Creates a VersionControl instance
   * @param {EditorManager} editorManager - Editor manager instance
   * @param {TimelineManager} timelineManager - Timeline manager instance
   * @param {StorageManager} storageManager - Storage manager instance
   * @param {UIManager} uiManager - UI manager instance
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
    
    /**
     * @private @type {number}
     * Index in the current branch's transactions array.
     * `INITIAL_TRANSACTION_INDEX` (-1) represents the initialContent state of the branch.
     */
    this._currentTransactionIndex = -1;
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
      this._initializeNewRepository();
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
    
    if (prefs && this._branches[prefs.currentBranchId]) {
      const branch = this._branches[prefs.currentBranchId];
      // Check if the transactionIndex is valid for the branch
      const indexIsValid = typeof prefs.currentTransactionIndex === 'number' &&
                           prefs.currentTransactionIndex >= INITIAL_TRANSACTION_INDEX &&
                           prefs.currentTransactionIndex < branch.transactions.length;

      if (indexIsValid) {
        this._currentBranchId = prefs.currentBranchId;
        this._currentTransactionIndex = prefs.currentTransactionIndex;
      } else {
        console.warn(`Loaded preference transactionIndex ${prefs.currentTransactionIndex} invalid for branch ${prefs.currentBranchId}. Resetting to branch tip.`);
        this._currentBranchId = prefs.currentBranchId; 
        this._currentTransactionIndex = branch.transactions.length > 0 ? branch.transactions.length - 1 : INITIAL_TRANSACTION_INDEX;
      }
    } else {
      // This case handles if loadedHistory exists but prefs are missing/invalid, or branch from prefs doesn't exist.
      // Or if loadedHistory itself is null/undefined (covered by the caller's check).
      if (!this._branches[DEFAULT_BRANCH_ID]) { 
        this._initializeNewRepository(); // If 'main' branch isn't in loaded history for some reason.
      } else {
        this._currentBranchId = DEFAULT_BRANCH_ID;
        // Default to the tip of the main branch if no valid preferences, or initial state if main is empty.
        const mainBranch = this._branches[DEFAULT_BRANCH_ID];
        this._currentTransactionIndex = mainBranch.transactions.length > 0 ? mainBranch.transactions.length -1 : INITIAL_TRANSACTION_INDEX;
      }
    }
  }
  
  /**
   * Update editor with current version content
   * @private
   */
  _updateEditorContent() {
    const currentText = this._reconstructText(this._currentBranchId, this._currentTransactionIndex);
    this.editorManager.setValue(currentText, true); // Programmatic change
    this.editorManager.updatePreviousContent(currentText);
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
   * Initializes a new repository with a default main branch.
   * This is called if no history is loaded or if the loaded history is fundamentally incomplete.
   * @private
   */
  _initializeNewRepository() {
    this._branches[DEFAULT_BRANCH_ID] = {
      id: DEFAULT_BRANCH_ID,
      parentBranchId: null,
      parentTransactionIndex: INITIAL_TRANSACTION_INDEX, // Main has no parent transaction it forked from
      initialContent: "", 
      transactions: [] // Log of pure opArrays for this branch
    };
    this._currentBranchId = DEFAULT_BRANCH_ID;
    this._currentTransactionIndex = INITIAL_TRANSACTION_INDEX; // Start at initialContent
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
   * Reconstructs text for a given branch up to a specific transaction index.
   * If targetTransactionIndex is `INITIAL_TRANSACTION_INDEX` (-1), returns the branch's initialContent.
   * @private
   */
  _reconstructText(branchId, targetTransactionIndex) {
    const branch = this._branches[branchId];
    if (!branch) {
      console.error(`_reconstructText: Branch ${branchId} not found.`);
      return ""; 
    }

    let textChars = branch.initialContent.split('');
    if (targetTransactionIndex === INITIAL_TRANSACTION_INDEX) {
      return branch.initialContent;
    }

    // Apply transactions up to and including the targetTransactionIndex
    for (let i = 0; i <= targetTransactionIndex && i < branch.transactions.length; i++) {
      const opDetails = branch.transactions[i]; 
      if (!Array.isArray(opDetails) || opDetails.length === 0) {
        console.warn("Invalid opDetails in transaction log at index " + i, opDetails);
        continue; 
      }
      
      const index = opDetails[0];
      let opType;

      // Determine operation type based on the structure of opDetails
      // opDetails[1] is string: Addition
      // opDetails[1] is number: Deletion of multiple characters
      // opDetails.length is 1: Deletion of single character
      if (opDetails.length === 2 && typeof opDetails[1] === 'string') {
        opType = 'a'; // Addition
      } else if (opDetails.length === 2 && typeof opDetails[1] === 'number') {
        opType = 'd_multi'; // Deletion (multiple characters)
      } else if (opDetails.length === 1 && typeof index === 'number') {
        opType = 'd_single'; // Deletion (single character)
      } else {
        opType = OP_TYPE_UNKNOWN;
      }
      
      if (opType === 'a') { // Add [index, string_to_add]
        const stringToAdd = opDetails[1];
        textChars.splice(index, 0, ...stringToAdd.split(''));
      } else if (opType === 'd_multi') { // Delete [index, count]
        const count = opDetails[1];
        textChars.splice(index, count);
      } else if (opType === 'd_single') { // Delete [index] (implies 1 char)
        textChars.splice(index, 1);
      } else {
        console.warn("Unknown operation type or malformed opDetails in transaction:", opDetails);
      }
    }
    
    return textChars.join('');
  }

  /**
   * Record a character typing action
   * @param {number} index - Index where character was typed
   * @param {string} char - Character typed
   * @param {string} [message] - Optional message
   */
  recordCharacterTyped(index, char, message) {
    // Optimized op: [index, string_to_add]
    const opArray = [index, char];
    // The 'inferredType' for _commitOperation is mainly for message generation if not overridden
    this._commitOperation(opArray, OP_TYPE_ADD, message || `Typed '${char}' at index ${index}`);
  }

  /**
   * Record a character deletion action
   * @param {number} index - Index of deleted character
   * @param {string} [message] - Optional message
   */
  recordCharacterDeletion(index, message) {
    // Optimized op for single character deletion: [index]
    const opArray = [index]; 
    // The 'inferredType' for _commitOperation is mainly for message generation
    this._commitOperation(opArray, OP_TYPE_DELETE, message || `Deleted character at index ${index}`);
  }

  /**
   * Record multiple character deletion action
   * @param {number} startIndex - Index where deletion started
   * @param {number} count - Number of characters deleted
   * @param {string} [message] - Optional message
   */
  recordMultipleCharacterDeletion(startIndex, count, message) {
    // Optimized op for multiple character deletion: [startIndex, count]
    const opArray = [startIndex, count];
    this._commitOperation(opArray, OP_TYPE_DELETE_MULTI, message || `Deleted ${count} characters starting at index ${startIndex}`);
  }
  
  /**
   * Get or create current branch
   * @private
   * @returns {object} Current branch
   */
  _getOrCreateCurrentBranch() {
    if (!this._branches[this._currentBranchId]) {
      console.warn(`Current branch '${this._currentBranchId}' not found during getOrCreate, attempting to recover or default.`);
      // With index-only, direct recovery to a specific transaction is hard without branch context.
      // We default to the start of 'main' or create it.
      if (this._branches[DEFAULT_BRANCH_ID]) {
        this._currentBranchId = DEFAULT_BRANCH_ID;
        const mainBranch = this._branches[DEFAULT_BRANCH_ID];
        this._currentTransactionIndex = mainBranch.transactions.length > 0 ? mainBranch.transactions.length -1 : INITIAL_TRANSACTION_INDEX;
      } else {
        this._initializeNewRepository(); // This sets currentBranchId and currentTransactionIndex
      }
      console.log(`Recovered current branch to: ${this._currentBranchId} at index ${this._currentTransactionIndex}`);
    }
    return this._branches[this._currentBranchId];
  }
  
  /**
   * Commits an operation (opArray), creating a new transaction log entry.
   * Handles new branch creation if necessary.
   * @private
   * @param {Array} opArray - The operation array e.g. [index, char] or [index]
   * @param {string} inferredType - For generating a default message if none provided by caller.
   * @param {string} message - A descriptive message for the operation (will be generated if not provided).
   */
  _commitOperation(opArray, inferredType, message) { // Message param kept for now, though not stored directly
    let currentBranch = this._getOrCreateCurrentBranch();
    
    const isAtTipOfBranch = this._currentTransactionIndex === currentBranch.transactions.length - 1;

    let targetBranchId = this._currentBranchId;
    let targetBranchObject = currentBranch;
    let autoBranchMessagePrefix = "";

    if (!isAtTipOfBranch) { 
      const newBranchName = `${BRANCH_ID_AUTOMATIC_PREFIX}${this._generateId().substring(0,12)}`;
      const parentBranchIdForNewBranch = this._currentBranchId;
      const parentTransactionIndexForNewBranch = this._currentTransactionIndex; // Where we are forking from
      
      const initialContentForNewBranch = this._reconstructText(parentBranchIdForNewBranch, parentTransactionIndexForNewBranch);

      this._branches[newBranchName] = {
        id: newBranchName,
        parentBranchId: parentBranchIdForNewBranch,
        parentTransactionIndex: parentTransactionIndexForNewBranch, 
        initialContent: initialContentForNewBranch,
        transactions: [] 
      };
      targetBranchId = newBranchName;
      this._currentBranchId = newBranchName; 
      targetBranchObject = this._branches[newBranchName];
      this._currentTransactionIndex = INITIAL_TRANSACTION_INDEX; // New branch starts at its initial content, before this new op
      autoBranchMessagePrefix = "(Branched) ";
    } else {
      // If at the tip, but not the initial state, and we are about to add a new transaction.
      // If _currentTransactionIndex is not -1, it means there are existing transactions.
      // If currentTransactionIndex < transactions.length -1 (which is covered by !isAtTipOfBranch),
      // it means we are not at the tip, so branching occurs.
      // If we *are* at the tip (isAtTipOfBranch is true), but currentTransactionIndex is not pointing
      // to the very last actual transaction (e.g., after an undo to an intermediate state on the *same* branch
      // and then typing), we need to truncate.
      // The condition `isAtTipOfBranch` means `this._currentTransactionIndex === currentBranch.transactions.length - 1`
      // This implies we are adding after the last known transaction. Truncation is only needed if
      // _currentTransactionIndex was *less than* transactions.length - 1, which is handled by the branching case.
      // So, if we are here (isAtTipOfBranch is true), no truncation of currentBranch is needed before adding.
    }
    
    // If an operation occurs when not at the absolute tip of the transactions log of the *current branch* (after an undo)
    // we should truncate the "future" transactions from that point on this branch before adding the new one.
    // This is different from branching. Branching occurs if we are not at the tip of version *markers* (previous model)
    // or more generally, if the current state is not the absolute end of the current branch's known history.

    // Corrected Truncation Logic for current branch if not branching:
    if (targetBranchObject === currentBranch && this._currentTransactionIndex < currentBranch.transactions.length - 1) {
        console.log(`Truncating transactions for current branch ${this._currentBranchId} from index ${this._currentTransactionIndex + 1}`);
        currentBranch.transactions = currentBranch.transactions.slice(0, this._currentTransactionIndex + 1);
    }

    targetBranchObject.transactions.push(opArray);
    this._currentTransactionIndex = targetBranchObject.transactions.length - 1; 
    
    // Message is not stored on transaction, but could be used for UI manager display
    const displayMessage = autoBranchMessagePrefix + (message || `${inferredType} operation performed`);
    if (this.uiManager) this.uiManager.displayMessage(displayMessage, 'info');

    this._updateEditorContent(); // Ensure editor is synced after commit.
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
    
    const parentTransactionIndexForNewBranch = this._currentTransactionIndex;
    const parentBranchId = this._currentBranchId;
    const parentBranch = this._branches[parentBranchId];

    if (!parentBranch) { 
      this.uiManager.displayMessage('Cannot create branch: Current branch context is invalid.', 'error');
      return false;
    }
    
    const initialContentForNewBranch = this._reconstructText(parentBranchId, parentTransactionIndexForNewBranch);

    this._branches[branchName] = {
      id: branchName,
      parentBranchId: parentBranchId,
      parentTransactionIndex: parentTransactionIndexForNewBranch,
      initialContent: initialContentForNewBranch,
      transactions: []
    };
    
    this._currentBranchId = branchName;
    this._currentTransactionIndex = INITIAL_TRANSACTION_INDEX; // New branch starts at its initialContent state
    
    this._updateEditorContent(); 
    this._updateUI();
    this._saveAllData();
    this.uiManager.displayMessage(`Branch "${branchName}" created and switched to.`, 'success');
    return true;
  }
  
  /**
   * Switch to a specific version (a specific transaction in a specific branch).
   * @param {string} branchId - Branch ID.
   * @param {number} transactionIndex - Transaction index. `INITIAL_TRANSACTION_INDEX` (-1) for branch's initial content.
   * @returns {boolean} Success status
   */
  switchToVersion(branchId, transactionIndex) { 
    if (!this._branches[branchId]) {
      console.error(`Branch ${branchId} not found for switchToVersion.`);
      return false;
    }

    // Check if already at the target state
    if (this._currentBranchId === branchId && this._currentTransactionIndex === transactionIndex) {
      // console.log(`switchToVersion: Already at ${branchId}_${transactionIndex}. No change needed.`);
      return true;
    }
    
    const indexIsValid = typeof transactionIndex === 'number' &&
                         transactionIndex >= INITIAL_TRANSACTION_INDEX && 
                         transactionIndex < this._branches[branchId].transactions.length;

    if (!indexIsValid && transactionIndex !== INITIAL_TRANSACTION_INDEX) { // Allow INITIAL_TRANSACTION_INDEX for initialContent
        // If transactionIndex is INITIAL_TRANSACTION_INDEX, it's valid if branch exists.
        // If transactionIndex is an actual index, it must be within bounds.
        if (transactionIndex === INITIAL_TRANSACTION_INDEX && this._branches[branchId].transactions.length === 0) { 
            // This is fine, switching to initialContent of an empty branch
        } else if (transactionIndex < INITIAL_TRANSACTION_INDEX || transactionIndex >= this._branches[branchId].transactions.length) {
            console.error(`Transaction index ${transactionIndex} is out of bounds for branch ${branchId}. Max index: ${this._branches[branchId].transactions.length -1}`);
            return false;
        }
    }
    
    this._currentBranchId = branchId;
    this._currentTransactionIndex = transactionIndex; 
    
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
    if (!currentBranch) return false;

    if (this._currentTransactionIndex === INITIAL_TRANSACTION_INDEX) { 
        return false; 
    }

    // Current index is N, so we go to N-1. If N is 0, we go to -1 (initialContent).
    this._currentTransactionIndex--; 
    
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
    if (!currentBranch) return false;

    // If current is -1 (initialContent) and there are transactions, redo to index 0.
    // If current is N and N+1 exists, redo to N+1.
    if (this._currentTransactionIndex < currentBranch.transactions.length - 1) {
        this._currentTransactionIndex++;
    } else {
        return false; // Already at the last transaction or no transactions to redo to from initial
    }
    
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
   * Gets information about the current state (branch and transaction).
   * This includes metadata like inferred operation type and a descriptive message.
   * @returns {object|null} Current state information or null if the current branch is not found.
   * The returned object has:
   *   `id`: { branchId: string, index: number } - Composite identifier for the state.
   *   `branchId`: string - The ID of the current branch.
   *   `transactionIndex`: number - The current transaction index.
   *   `timestamp`: number - Ephemeral timestamp of when this info was generated.
   *   `type`: string - Inferred type of the operation (e.g., OP_TYPE_ADD, OP_TYPE_INITIAL).
   *   `message`: string - A descriptive message for the state.
   *   `op`: Array|null - The raw operation array for the transaction, or null for initialContent.
   */
  getCurrentStateInfo() {
    const branch = this._branches[this._currentBranchId];
    if (!branch) return null;
    
    let currentOpArray = null;
    let timestamp = Date.now(); // Timestamps are now ephemeral, generated on query
    let opInfo = { type: OP_TYPE_UNKNOWN, description: "State information unavailable" };

    if (this._currentTransactionIndex !== INITIAL_TRANSACTION_INDEX) {
      if (this._currentTransactionIndex >= 0 && this._currentTransactionIndex < branch.transactions.length) {
        currentOpArray = branch.transactions[this._currentTransactionIndex];
      } else {
        console.error(`getCurrentStateInfo: _currentTransactionIndex ${this._currentTransactionIndex} is out of bounds for branch ${branch.id}. Max index: ${branch.transactions.length -1}`);
        // Attempt to recover or return a sensible default for a corrupted state
        this._currentTransactionIndex = branch.transactions.length - 1; // Go to last known good state
        if (this._currentTransactionIndex >=0) {
            currentOpArray = branch.transactions[this._currentTransactionIndex];
        } else { // Branch is empty or became empty
             this._currentTransactionIndex = INITIAL_TRANSACTION_INDEX; // Fallback to initial state
             // currentOpArray remains null
        }
      }

      if (currentOpArray) {
        opInfo = this._getOperationInfo(currentOpArray);
      } else if (this._currentTransactionIndex === INITIAL_TRANSACTION_INDEX) { // Explicitly check if recovery led to initial state
        opInfo = {
          type: branch.id === DEFAULT_BRANCH_ID ? OP_TYPE_INITIAL : OP_TYPE_BRANCH_CREATED,
          description: branch.id === DEFAULT_BRANCH_ID ? "Initial empty content" : `Branched to ${branch.id} (initial state)`
        };
      }

    } else { // Represents the INITIAL_TRANSACTION_INDEX state of the branch
      if (branch.id === DEFAULT_BRANCH_ID) {
        opInfo = { type: OP_TYPE_INITIAL, description: "Initial empty content" };
      } else {
        opInfo = { type: OP_TYPE_BRANCH_CREATED, description: `Branched to ${branch.id} (initial state)` };
      }
    }
    
    // The ID for timeline/UI purposes is now a composite of branchId and transactionIndex
    const stateIdentifier = {
        branchId: this._currentBranchId,
        index: this._currentTransactionIndex
    };

    return {
      id: stateIdentifier, // Composite ID for UI
      branchId: this._currentBranchId, // Redundant with id.branchId, but kept for direct access
      transactionIndex: this._currentTransactionIndex, // Actual index
      timestamp: timestamp, // Ephemeral timestamp
      type: opInfo.type, 
      message: opInfo.description, // Generated message
      op: currentOpArray // The actual operation array, if applicable
    };
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
    if (this._branches[DEFAULT_BRANCH_ID] && this._branches[DEFAULT_BRANCH_ID].transactions.length > 0) {
      this._currentBranchId = DEFAULT_BRANCH_ID;
      this._currentTransactionIndex = this._branches[DEFAULT_BRANCH_ID].transactions.length - 1;
    } else if (this._branches[DEFAULT_BRANCH_ID]) { // Main branch exists but is empty
      this._currentBranchId = DEFAULT_BRANCH_ID;
      this._currentTransactionIndex = INITIAL_TRANSACTION_INDEX;
    } else {
      this._initializeNewRepository(); // If 'main' is missing entirely
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
      currentTransactionIndex: this._currentTransactionIndex // Changed from currentTransactionId
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

  /**
   * Gets state information for a specific transaction index on a specific branch.
   * This is used by UI components like the timeline to get details for any point in history.
   * @param {string} branchId - The ID of the branch.
   * @param {number} transactionIndex - The index of the transaction (`INITIAL_TRANSACTION_INDEX` for initialContent).
   * @returns {object|null} An object with state details, or null if invalid.
   */
  getStateInfoAt(branchId, transactionIndex) {
    const branch = this._branches[branchId];
    if (!branch) {
      console.error(`getStateInfoAt: Branch ${branchId} not found.`);
      return null;
    }

    const indexIsValid = typeof transactionIndex === 'number' &&
                         transactionIndex >= INITIAL_TRANSACTION_INDEX &&
                         transactionIndex < branch.transactions.length;

    if (!indexIsValid) {
      console.error(`getStateInfoAt: Transaction index ${transactionIndex} is out of bounds for branch ${branchId}. Max index: ${branch.transactions.length -1}`);
      return null;
    }

    let opArray = null;
    let timestamp = Date.now(); // Ephemeral timestamp
    let opInfo = { type: OP_TYPE_UNKNOWN, description: "State information unavailable" };

    if (transactionIndex !== INITIAL_TRANSACTION_INDEX) {
      opArray = branch.transactions[transactionIndex];
      opInfo = this._getOperationInfo(opArray);
    } else { // Represents the initialContent state of the branch
      if (branch.id === DEFAULT_BRANCH_ID) {
        opInfo = { type: OP_TYPE_INITIAL, description: "Initial empty content" };
      } else {
        // Attempt to get a more specific creation message for a branch
        const parentBranch = this._branches[branch.parentBranchId];
        const parentOpMessage = parentBranch && branch.parentTransactionIndex !== INITIAL_TRANSACTION_INDEX && branch.parentTransactionIndex < parentBranch.transactions.length ? 
                                `from op [${parentBranch.transactions[branch.parentTransactionIndex].join(',')}] on ${branch.parentBranchId}` : 
                                `from ${branch.parentBranchId}`;
        opInfo = { type: OP_TYPE_BRANCH_CREATED, description: `Branched to ${branch.id} (initial state) ${parentOpMessage}` };
      }
    }

    const stateIdentifier = {
        branchId: branchId,
        index: transactionIndex
    };

    return {
      id: stateIdentifier, // Composite ID for UI
      branchId: branchId, 
      transactionIndex: transactionIndex, 
      timestamp: timestamp, 
      type: opInfo.type, 
      message: opInfo.description, 
      op: opArray 
    };
  }

  /**
   * Interprets a raw operation array and returns structured information about it.
   * The opArray format is:
   * - Add: `[index, string_to_add]`
   * - Delete single: `[index]` (implies 1 character at that index)
   * - Delete multiple: `[index, count_to_delete]`
   * @private
   * @param {Array} opArray - The operation array.
   * @returns {{type: string, description: string}} An object containing the operation type and a descriptive message.
   *           Returns OP_TYPE_UNKNOWN if the opArray is malformed.
   */
  _getOperationInfo(opArray) {
    if (!Array.isArray(opArray) || opArray.length === 0) {
      return { type: OP_TYPE_UNKNOWN, description: 'Invalid or empty operation array' };
    }

    const index = opArray[0];

    // Addition: [index, string_to_add]
    if (opArray.length === 2 && typeof opArray[1] === 'string') {
      const charOrString = opArray[1];
      return { type: OP_TYPE_ADD, description: `Typed '${charOrString}' at index ${index}` };
    }
    // Deletion (multiple characters): [index, count]
    else if (opArray.length === 2 && typeof opArray[1] === 'number') {
      const count = opArray[1];
      return { type: OP_TYPE_DELETE_MULTI, description: `Deleted ${count} characters starting at index ${index}` };
    }
    // Deletion (single character): [index]
    else if (opArray.length === 1 && typeof index === 'number') {
      // This implies deletion of 1 character at 'index'
      return { type: OP_TYPE_DELETE, description: `Deleted character at index ${index}` };
    }
    
    console.warn("Unknown operation type or malformed opDetails in transaction:", opArray);
    return { type: OP_TYPE_UNKNOWN, description: 'Unknown or malformed operation' };
  }
} 