/**
 * @class UIManager
 * @description Manages global UI elements, interactions, and status display.
 *              It handles the setup of UI controls, global event listeners (keyboard shortcuts, mouse events for timeline),
 *              and provides methods for displaying messages and updating UI components like version information.
 */
export class UIManager {
  // Constants for DOM selectors, IDs, and classes
  static RAW_STORAGE_DISPLAY_ID = 'raw-storage-display';
  static CONTROL_BTN_CLASS = 'control-btn';
  static EXPORT_BTN_ID = 'export-btn';
  static IMPORT_BTN_ID = 'import-btn';
  static BRANCH_BTN_ID = 'branch-btn';

  // Constants for message types
  static MESSAGE_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error',
  };

  // Constants for keyboard keys
  static KEY_Z = 'z';
  static KEY_Y = 'y';
  static KEY_B = 'b';

  /**
   * Creates a UIManager instance.
   * @param {import('./versionControl.js').VersionControlV2} versionControl - Main version control instance.
   * @param {import('./storageManager.js').StorageManager} storageManager - Storage manager instance.
   * @param {import('./timelineManager.js').TimelineManagerV2} timelineManager - Timeline manager instance.
   */
  constructor(versionControl, storageManager, timelineManager) {
    this.versionControl = versionControl;
    this.storageManager = storageManager;
    this.timelineManager = timelineManager;
    this.controlsContainer = null;
    this.rawStorageDisplayElement = null; // For caching the DOM element
  }

  /**
   * Initializes global keyboard shortcuts and mouse listeners.
   * These listeners handle application-wide actions like undo/redo, new branch creation,
   * and delegating mouse events for timeline dragging.
   */
  initGlobalEventListeners() {
    document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
    document.addEventListener('mousemove', this._handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleGlobalMouseUp.bind(this));
  }

  /**
   * Handles application-wide keyboard shortcuts.
   * - Ctrl/Cmd + Z: Undo
   * - Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
   * - Ctrl/Cmd + B: Create a new branch
   * @private
   * @param {KeyboardEvent} event - The keyboard event.
   */
  _handleGlobalKeyDown(event) {
    if (!this.versionControl) return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

    if (ctrlKey && !event.shiftKey && event.key.toLowerCase() === UIManager.KEY_Z) {
      event.preventDefault();
      if (this.versionControl.undo) {
        this.versionControl.undo();
      }
    } else if (
      (ctrlKey && event.shiftKey && event.key.toLowerCase() === UIManager.KEY_Z) ||
      (ctrlKey && !event.shiftKey && event.key.toLowerCase() === UIManager.KEY_Y)
    ) {
      event.preventDefault();
      if (this.versionControl.redo) {
        this.versionControl.redo();
      }
    } else if (ctrlKey && !event.shiftKey && event.key.toLowerCase() === UIManager.KEY_B) {
      event.preventDefault();
      const branchName = this.promptForBranchName();
      if (branchName && this.versionControl.createBranch) {
        this.versionControl.createBranch(branchName);
        // The createBranch method in VersionControl should ideally handle its own success message
        // or return a status that UIManager can use.
        // this.displayMessage(`Branch "${branchName}" created`, UIManager.MESSAGE_TYPES.SUCCESS);
      }
    }
  }

  /**
   * Handles global mousemove events, primarily for timeline drag operations.
   * Delegates the event to the TimelineManager if a drag operation is active.
   * @private
   * @param {MouseEvent} event - The mouse event.
   */
  _handleGlobalMouseMove(event) {
    if (this.timelineManager && this.timelineManager.isDragging) {
      this.timelineManager.handleDragMove(event);
    }
  }

  /**
   * Handles global mouseup events, primarily to end timeline drag operations.
   * Delegates the event to the TimelineManager if a drag operation was active.
   * @private
   * @param {MouseEvent} event - The mouse event.
   */
  _handleGlobalMouseUp(event) {
    if (this.timelineManager && this.timelineManager.isDragging) {
      this.timelineManager.handleDragEnd(event);
    }
  }

  /**
   * Sets up UI control buttons (Export, Import, New Branch) in the specified container.
   * @param {string} controlsContainerSelector - CSS selector for the container where controls will be added.
   */
  setupControls(controlsContainerSelector) {
    this.controlsContainer = document.querySelector(controlsContainerSelector);
    if (!this.controlsContainer) {
      console.warn(`Controls container with selector "${controlsContainerSelector}" not found.`);
      return;
    }

    const exportBtn = this._createButton('Export History', UIManager.EXPORT_BTN_ID, this._handleExportClick.bind(this));
    const importBtn = this._createButton('Import History', UIManager.IMPORT_BTN_ID, this._handleImportClick.bind(this));
    const branchBtn = this._createButton('New Branch', UIManager.BRANCH_BTN_ID, this._handleBranchClick.bind(this));

    this.controlsContainer.appendChild(exportBtn);
    this.controlsContainer.appendChild(importBtn);
    this.controlsContainer.appendChild(branchBtn);
  }

  /**
   * Creates a button element with the given text, ID, and click handler.
   * @private
   * @param {string} text - The text content for the button.
   * @param {string} id - The ID for the button.
   * @param {Function} clickHandler - The event handler for the button's click event.
   * @returns {HTMLButtonElement} The created button element.
   */
  _createButton(text, id, clickHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.id = id;
    button.classList.add(UIManager.CONTROL_BTN_CLASS);
    button.addEventListener('click', clickHandler);
    return button;
  }

  /**
   * Handles the click event for the 'Export History' button.
   * Retrieves all branch data from VersionControl and uses StorageManager to export it.
   * @private
   */
  _handleExportClick() {
    if (!this.versionControl || !this.storageManager || !this.storageManager.exportHistoryToFile) {
      this.displayMessage('Export functionality is not available or properly configured.', UIManager.MESSAGE_TYPES.ERROR);
      return;
    }

    try {
      const data = this.versionControl.getAllBranchesData();
      this.storageManager.exportHistoryToFile(data);
      this.displayMessage('History exported successfully.', UIManager.MESSAGE_TYPES.SUCCESS);
    } catch (error) {
      console.error('Export failed:', error);
      this.displayMessage(`Export failed: ${error.message}`, UIManager.MESSAGE_TYPES.ERROR);
    }
  }

  /**
   * Handles the click event for the 'Import History' button.
   * Uses StorageManager to import data from a file and loads it into VersionControl.
   * @private
   */
  async _handleImportClick() {
    if (!this.storageManager || !this.storageManager.importHistoryFromFile || !this.versionControl || !this.versionControl.loadAllBranchesData) {
      this.displayMessage('Import functionality is not available or properly configured.', UIManager.MESSAGE_TYPES.ERROR);
      return;
    }

    try {
      const importedData = await this.storageManager.importHistoryFromFile();
      if (importedData) { // importHistoryFromFile should ideally throw an error or return null/undefined on failure/cancellation
        this.versionControl.loadAllBranchesData(importedData);
        this.displayMessage('History imported successfully.', UIManager.MESSAGE_TYPES.SUCCESS);
        // It's crucial that after import, the UI (editor, timeline, etc.) is refreshed.
        // This might involve calling methods on editorManager, timelineManager, or versionControl.
        if (this.timelineManager && this.timelineManager.renderTimeline) {
           this.timelineManager.renderTimeline();
        }
        this.updateVersionInfo(); // Basic update
      } else {
        this.displayMessage('Import was cancelled or failed to produce data.', UIManager.MESSAGE_TYPES.INFO);
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.displayMessage(`Import failed: ${error.message}`, UIManager.MESSAGE_TYPES.ERROR);
    }
  }

  /**
   * Handles the click event for the 'New Branch' button.
   * Prompts the user for a branch name and instructs VersionControl to create it.
   * @private
   */
  _handleBranchClick() {
    if (!this.versionControl || !this.versionControl.createBranch) {
      this.displayMessage('Branch functionality is not available or properly configured.', UIManager.MESSAGE_TYPES.ERROR);
      return;
    }

    const branchName = this.promptForBranchName();
    if (branchName) {
      try {
        this.versionControl.createBranch(branchName);
        // Success message is now handled by VersionControl or its post-creation hook
        // this.displayMessage(`Branch "${branchName}" created successfully.`, UIManager.MESSAGE_TYPES.SUCCESS);
      } catch (error) {
        console.error(`Failed to create branch "${branchName}":`, error);
        this.displayMessage(`Failed to create branch: ${error.message}`, UIManager.MESSAGE_TYPES.ERROR);
      }
    }
  }

  /**
   * Prompts the user to enter a name for a new branch.
   * @returns {string|null} The entered branch name, or null if the user cancels the prompt.
   */
  promptForBranchName() {
    return prompt('Enter a name for the new branch:');
  }

  /**
   * Displays an application status message.
   * Currently, this logs to the console. For a richer UI, this could be adapted
   * to display messages in a dedicated status area on the webpage.
   * @param {string} message - The message text to display.
   * @param {'info'|'success'|'error'} [type='info'] - The type of message (e.g., 'info', 'success', 'error').
   *                                                  Uses values from `UIManager.MESSAGE_TYPES`.
   */
  displayMessage(message, type = UIManager.MESSAGE_TYPES.INFO) {
    // TODO: Enhance to display messages in a dedicated UI element instead of just console.log
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Updates UI elements that display current version and branch information.
   * This method should be called whenever the current version or branch changes.
   */
  updateVersionInfo() {
    if (!this.versionControl || !this.versionControl.getCurrentStateInfo) {
      console.warn("Version control not ready for updateVersionInfo or getCurrentStateInfo is missing.");
      return;
    }

    // const currentStateInfo = this.versionControl.getCurrentStateInfo(); // Potentially useful
    // const currentBranchId = currentStateInfo ? currentStateInfo.branchId : 'N/A'; // Potentially useful
    // const versionDisplayId = currentStateInfo ? `${currentStateInfo.id.branchId}@${currentStateInfo.id.index}` : 'N/A'; // Example of a display ID

    // Example: Update a hypothetical status bar
    // const statusBarElement = document.getElementById('status-bar');
    // if (statusBarElement && currentStateInfo) {
    //   statusBarElement.textContent = `Branch: ${currentBranchId} - Version: ${versionDisplayId}`;
    // }

    this.updateRawStorageDisplay(); // Continue to update raw storage display
  }


  /**
   * Retrieves the DOM element for displaying raw storage data, caching it on first access.
   * @private
   * @returns {HTMLElement|null} The raw storage display element, or null if not found.
   */
  _getRawStorageDisplayElement() {
    if (!this.rawStorageDisplayElement) {
      this.rawStorageDisplayElement = document.getElementById(UIManager.RAW_STORAGE_DISPLAY_ID);
      if (!this.rawStorageDisplayElement) {
        console.warn(`Raw storage display element with ID "${UIManager.RAW_STORAGE_DISPLAY_ID}" not found.`);
      }
    }
    return this.rawStorageDisplayElement;
  }


  /**
   * Updates the UI element that displays the raw data of all branches and versions.
   * This is primarily for debugging and demonstration purposes.
   */
  updateRawStorageDisplay() {
    const displayElement = this._getRawStorageDisplayElement();
    if (!displayElement) return;

    if (!this.versionControl || !this.versionControl.getAllBranchesData) {
      displayElement.textContent = "Version control is not available or cannot fetch branch data.";
      return;
    }

    try {
      const allBranchesData = this.versionControl.getAllBranchesData();
      if (allBranchesData && Object.keys(allBranchesData).length > 0) {
        displayElement.textContent = this.formatJsonOutput(allBranchesData);
      } else {
        displayElement.textContent = "No branches or versions available in storage.";
      }
    } catch (error) {
      console.error("Failed to get or format all branches data for display:", error);
      displayElement.textContent = "Error displaying branch data.";
    }
  }

  /**
   * Formats a JavaScript object or a JSON string into a human-readable, pretty-printed JSON string.
   * If the input is a string, it attempts to parse it as JSON first.
   * @param {Object|string} data - The data to format (JavaScript object or JSON string).
   * @returns {string} A formatted JSON string, or an error message if formatting fails.
   */
  /**
   * Formats a JSON object or string into a readable string representation.
   * @param {Object|string} json - The JSON object or string to format.
   * @returns {string} The formatted JSON string.
   */
  formatJsonOutput(json) {
    if (typeof json === 'string') {
      try {
        json = JSON.parse(json);
      } catch (error) {
        console.error("Error parsing JSON string:", error);
        return json;
      }
    }
    const output = JSON.stringify(json, function(k, v) {
      if (v instanceof Array) {
        return JSON.stringify(v);
      }
      return v;
    }, 2).replace(/\\/g, '')
          .replace(/\"\[/g, '[')
          .replace(/\]\"/g, ']')
          .replace(/\"\{/g, '{')
          .replace(/\}\"/g, '}');
    return output;
  }

} 