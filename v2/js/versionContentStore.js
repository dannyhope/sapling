/**
 * @class VersionContentStore
 * @description Manages character-history data structure for text content tracking.
 * Handles character operations and reconstructs text from sparse array format.
 */
export class VersionContentStore {
  /**
   * Creates a VersionContentStore instance
   * @param {Array<Array<string|null>>} [initialSparseContent=[]] - Initial sparse content
   */
  constructor(initialSparseContent = []) {
    /** @private @type {Array<Array<string|null>>} */
    this._sparseContent = JSON.parse(JSON.stringify(initialSparseContent)); // Deep copy
  }

  /**
   * Inserts a character at a given index, shifting subsequent characters
   * @param {number} index - Index where to insert character
   * @param {string} char - Character to insert
   */
  insertChar(index, char) {
    if (index < 0 || index > this._sparseContent.length || typeof char !== 'string' || char.length !== 1) {
      console.error(`Invalid insertion: index=${index}, char="${char}"`);
      return;
    }
    this._sparseContent.splice(index, 0, [char]);
  }

  /**
   * Logs a character deletion at a given index by appending null to its history
   * @param {number} index - Index of character to delete
   */
  deleteChar(index) {
    if (index < 0 || index >= this._sparseContent.length || !this._sparseContent[index]) {
      console.error(`Invalid deletion at index ${index}`);
      return;
    }
    
    const charHistory = this._sparseContent[index];
    if (charHistory.length > 0 && charHistory[charHistory.length - 1] !== null) {
      charHistory.push(null);
    } else if (charHistory.length === 0) {
      console.warn(`Attempted to delete at index ${index} with empty history`);
    }
  }

  /**
   * Logs a typed character by appending to history array or creating new slot
   * @param {number} index - Index where character is typed
   * @param {string} char - Character typed
   */
  typeChar(index, char) {
    if (index < 0 || index > this._sparseContent.length || typeof char !== 'string' || char.length !== 1) {
      console.error(`Invalid typing: index=${index}, char="${char}"`);
      return;
    }

    if (index === this._sparseContent.length) {
      // Typing at end of document (extending it)
      this._sparseContent.push([char]);
    } else {
      // Typing into existing character slot
      if (!this._sparseContent[index]) {
        this._sparseContent[index] = [];
      }
      
      if (!Array.isArray(this._sparseContent[index])) {
        console.error(`Slot at index ${index} is not an array!`);
        this._sparseContent[index] = [char]; // Reset with new history
      } else {
        this._sparseContent[index].push(char);
      }
    }
  }

  /**
   * Reconstructs current text from sparse array
   * @returns {string} Plain text representation
   */
  getCurrentText() {
    let text = '';
    for (const charHistory of this._sparseContent) {
      if (charHistory && charHistory.length > 0) {
        const lastCharState = charHistory[charHistory.length - 1];
        if (lastCharState !== null) {
          text += lastCharState;
        }
      }
    }
    return text;
  }

  /**
   * Gets a deep copy of the internal sparse content array
   * @returns {Array<Array<string|null>>} Copy of sparse content
   */
  getSparseContent() {
    return JSON.parse(JSON.stringify(this._sparseContent));
  }

  /**
   * Creates a sparse content representation from plain text
   * @param {string} text - Plain text string to convert
   * @returns {Array<Array<string|null>>} Generated sparse content
   */
  static sparseContentFromText(text) {
    return Array.from(text).map(char => [char]);
  }
} 