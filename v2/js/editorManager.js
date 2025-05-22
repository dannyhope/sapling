/**
 * @class EditorManager
 * @description Manages text editor input/output and tracks character-level changes
 */
export class EditorManager {
  /**
   * Creates an EditorManager instance
   * @param {string} editorId - ID of the textarea element
   * @param {VersionControl} versionControl - Main version control instance
   * @throws {Error} If editor element not found
   */
  constructor(editorId, versionControl) {
    this.editorElement = document.getElementById(editorId);
    if (!this.editorElement) {
      throw new Error(`Editor element with ID '${editorId}' not found`);
    }
    this.versionControl = versionControl; // Will be set later if null
    this._previousContent = this.editorElement.value;
    this._isProgrammaticChange = false;
    
    this._initEventListeners();
  }

  /**
   * Initialize editor event listeners
   * @private
   */
  _initEventListeners() {
    this.editorElement.addEventListener('input', this._handleInput.bind(this));
    this.editorElement.addEventListener('keydown', this._handleKeyDown.bind(this));
  }

  /**
   * Handle input events (character additions)
   * @private
   * @param {InputEvent} event - Input event
   */
  _handleInput(event) {
    if (this._isProgrammaticChange || !this.versionControl) return;

    const currentContent = this.editorElement.value;
    const previousContent = this._previousContent;
    
    // Skip if content hasn't changed
    if (currentContent === previousContent) return;
    
    const cursorPosition = this.editorElement.selectionStart;

    // Detect single character typed
    if (currentContent.length === previousContent.length + 1) {
      const charTyped = currentContent[cursorPosition - 1];
      const index = cursorPosition - 1;
      
      if (charTyped !== undefined) {
        this.versionControl.recordCharacterTyped(index, charTyped, 'Character typed');
      } else {
        console.warn(`Detected length increase by 1, but could not identify character. Cursor: ${cursorPosition}`);
      }
    } else {
      // Fallback for complex changes (paste, multi-char input, replacements)
      console.warn(`Detected complex change. Type: ${event.inputType}, lengths: ${currentContent.length}/${previousContent.length}`);
    }
  }
  
  /**
   * Handle keydown events for deletion keys
   * @private
   * @param {KeyboardEvent} event - Keydown event
   */
  _handleKeyDown(event) {
    if (this._isProgrammaticChange || !this.versionControl) return;

    const key = event.key;
    const cursorPosition = this.editorElement.selectionStart;

    if (key === 'Backspace' && cursorPosition > 0) {
      event.preventDefault();
      this._handleDeletion(cursorPosition - 1, 'Backspace pressed');
    } else if (key === 'Delete' && cursorPosition < this.editorElement.value.length) {
      event.preventDefault();
      this._handleDeletion(cursorPosition, 'Delete pressed');
    }
  }
  
  /**
   * Handle character deletion at index
   * @private
   * @param {number} index - Character index to delete
   * @param {string} message - Message describing deletion
   */
  _handleDeletion(index, message) {
    const currentContent = this.editorElement.value;
    const newContent = currentContent.substring(0, index) + currentContent.substring(index + 1);
    
    this.editorElement.value = newContent;
    this.editorElement.setSelectionRange(index, index);
    
    this.versionControl.recordCharacterDeletion(index, message);
  }

  /**
   * Get current editor text content
   * @returns {string} Current text content
   */
  getValue() {
    return this.editorElement.value;
  }

  /**
   * Set editor text content
   * @param {string} text - Text to set
   * @param {boolean} [isProgrammatic=true] - Whether change should be recorded
   */
  setValue(text, isProgrammatic = true) {
    const oldFlag = this._isProgrammaticChange;
    this._isProgrammaticChange = isProgrammatic;
    this.editorElement.value = text;
    this._previousContent = text;
    this._isProgrammaticChange = oldFlag;
  }

  /**
   * Update the internal previous content state
   * @param {string} content - Content to set as baseline
   */
  updatePreviousContent(content) {
    this._previousContent = content;
  }
} 