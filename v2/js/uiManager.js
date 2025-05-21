/**
 * @class UIManagerV2
 * @description Manages global UI elements, interactions and status display
 */
export class UIManagerV2 {
  /**
   * Creates a UIManagerV2 instance
   * @param {VersionControlV2} versionControl - Main version control instance
   * @param {StorageManagerV2} storageManager - Storage manager instance
   * @param {TimelineManagerV2} timelineManager - Timeline manager instance
   */
  constructor(versionControl, storageManager, timelineManager) {
    this.versionControl = versionControl;
    this.storageManager = storageManager;
    this.timelineManager = timelineManager;
    this.controlsContainer = null;
  }

  /**
   * Initialize global keyboard shortcuts and mouse listeners
   */
  initGlobalEventListeners() {
    document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
    // Add mouse event listeners for timeline drag operations if needed
    document.addEventListener('mousemove', this._handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleGlobalMouseUp.bind(this));
  }

  /**
   * Handle application-wide keyboard shortcuts
   * @private
   * @param {KeyboardEvent} event - Keyboard event
   */
  _handleGlobalKeyDown(event) {
    // Skip if version control is not initialized
    if (!this.versionControl) return;
    
    const isMac = navigator.platform.includes('Mac');
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
    
    if (ctrlKey && !event.shiftKey && event.key === 'z') {
      // Ctrl/Cmd + Z: Undo
      event.preventDefault();
      if (this.versionControl.undo) {
        this.versionControl.undo();
      }
    } else if ((ctrlKey && event.shiftKey && event.key === 'z') || 
               (ctrlKey && event.key === 'y')) {
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      event.preventDefault();
      if (this.versionControl.redo) {
        this.versionControl.redo();
      }
    } else if (ctrlKey && event.key === 'b') {
      // Ctrl/Cmd + B: Create branch
      event.preventDefault();
      const branchName = this.promptForBranchName();
      if (branchName && this.versionControl.createBranch) {
        this.versionControl.createBranch(branchName);
      }
    }
  }

  /**
   * Handles global mousemove for timeline drag, delegating to TimelineManagerV2.
   * @private
   * @param {MouseEvent} event
   */
  _handleGlobalMouseMove(event) {
    if (this.timelineManager && this.timelineManager.isDragging) {
      this.timelineManager.handleDragMove(event);
    }
  }

  /**
   * Handles global mouseup for timeline drag, delegating to TimelineManagerV2.
   * @private
   * @param {MouseEvent} event
   */
  _handleGlobalMouseUp(event) {
    if (this.timelineManager && this.timelineManager.isDragging) {
      this.timelineManager.handleDragEnd(event);
    }
  }

  /**
   * Set up UI controls for version history operations
   * @param {string} controlsContainerSelector - CSS selector for controls container
   */
  setupControls(controlsContainerSelector) {
    this.controlsContainer = document.querySelector(controlsContainerSelector);
    if (!this.controlsContainer) {
      console.warn("Controls container not found");
      return;
    }
    
    const exportBtn = this._createButton('Export History', 'export-btn', this._handleExportClick.bind(this));
    const importBtn = this._createButton('Import History', 'import-btn', this._handleImportClick.bind(this));
    const branchBtn = this._createButton('New Branch', 'branch-btn', this._handleBranchClick.bind(this));
    
    // Add buttons to container
    this.controlsContainer.appendChild(exportBtn);
    this.controlsContainer.appendChild(importBtn);
    this.controlsContainer.appendChild(branchBtn);
  }
  
  /**
   * Create a button element
   * @private
   * @param {string} text - Button text
   * @param {string} id - Button ID
   * @param {Function} clickHandler - Click event handler
   * @returns {HTMLButtonElement} Created button
   */
  _createButton(text, id, clickHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.id = id;
    button.classList.add('control-btn');
    button.addEventListener('click', clickHandler);
    return button;
  }
  
  /**
   * Handle export button click
   * @private
   */
  _handleExportClick() {
    if (!this.versionControl || !this.storageManager.exportHistoryToFile) {
      this.displayMessage('Export functionality not implemented', 'error');
      return;
    }
    
    const data = this.versionControl.getAllBranchesData();
    this.storageManager.exportHistoryToFile(data);
    this.displayMessage('History exported successfully', 'success');
  }

  /**
   * Handle import button click
   * @private
   */
  async _handleImportClick() {
    if (!this.storageManager.importHistoryFromFile || !this.versionControl) {
      this.displayMessage('Import functionality not implemented', 'error');
      return;
    }
    
    try {
      const importedData = await this.storageManager.importHistoryFromFile();
      if (importedData && this.versionControl.loadAllBranchesData) {
        this.versionControl.loadAllBranchesData(importedData);
        this.displayMessage('History imported successfully', 'success');
      }
    } catch (error) {
      this.displayMessage(`Import failed: ${error.message}`, 'error');
    }
  }
  
  /**
   * Handle new branch button click
   * @private
   */
  _handleBranchClick() {
    if (!this.versionControl || !this.versionControl.createBranch) {
      this.displayMessage('Branch functionality not implemented', 'error');
      return;
    }
    
    const branchName = this.promptForBranchName();
    if (branchName) {
      this.versionControl.createBranch(branchName);
      this.displayMessage(`Branch "${branchName}" created`, 'success');
    }
  }

  /**
   * Prompt user for a branch name
   * @returns {string|null} Branch name or null if cancelled
   */
  promptForBranchName() {
    return prompt('Enter a name for the new branch:');
  }

  /**
   * Display application status or messages
   * @param {string} message - Message to display
   * @param {'info'|'success'|'error'} type - Message type
   */
  displayMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Future implementation: Display in UI instead of console
    // const messageElement = document.getElementById('status-message');
    // if (messageElement) {
    //   messageElement.textContent = message;
    //   messageElement.className = `status-message ${type}`;
    //   
    //   // Auto-hide after a delay
    //   setTimeout(() => {
    //     messageElement.textContent = '';
    //     messageElement.className = 'status-message';
    //   }, 3000);
    // }
  }

  /**
   * Update version info UI elements
   */
  updateVersionInfo() {
    if (!this.versionControl || !this.versionControl.getCurrentVersion) {
      console.warn("Version control not ready for updateVersionInfo");
      return;
    }
    
    const currentVersion = this.versionControl.getCurrentVersion();
    const currentBranchId = this.versionControl._currentBranchId;

    // Future: Update UI elements with version/branch info
    this.updateRawStorageDisplay();
  }

  /**
   * Update the raw storage display element
   */
  updateRawStorageDisplay() {
    const displayElement = document.getElementById('raw-storage-display');
    if (!displayElement) return;

    if (!this.versionControl || !this.versionControl.getAllBranchesData) {
      displayElement.textContent = "Version control not available or cannot fetch branch data.";
      return;
    }

    const allBranchesData = this.versionControl.getAllBranchesData();
    if (allBranchesData && Object.keys(allBranchesData).length > 0) {
      displayElement.textContent = JSON.stringify(allBranchesData, null, 2);
    } else {
      displayElement.textContent = "No branches or versions available.";
    }
  }
} 