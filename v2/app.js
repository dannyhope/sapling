/**
 * @file app-v2.js
 * @description Client-side text version control system - Version 2.
 *
 * This project implements a robust, modular, and well-documented text version control system
 * directly within the browser. It aims to provide a seamless experience for users to track
 * changes to text content, visualize version history, manage branches, and navigate
 * through different versions of their work.
 *
 * Core Functionality:
 * - Text Input Management: Captures granular text changes (single character typing and deletions)
 *   from a designated editor element.
 * - Version Creation: Records text states as distinct versions, utilizing a specialized
 *   `VersionContentStore` that maintains a history for each character slot in the document.
 *   This allows for a rich, character-level history (e.g., `['a', null, 'b']` for a character 'a'
 *   deleted and then replaced by 'b').
 * - History Visualization: Displays an interactive timeline of versions and branches (currently basic).
 * - Branch Management: (Scaffolded) Allows users to create, switch, and manage development branches.
 * - Version Navigation: (Scaffolded) Enables users to view and revert to previous text states.
 * - Data Persistence: Saves and loads version history and user preferences using local storage.
 *   File export/import is scaffolded.
 *
 * Architectural Principles:
 * - Object-Oriented Design (OOP): The system is built using classes to encapsulate
 *   responsibilities (EditorManager, TimelineManager, StorageManager, VersionContentStore, VersionControl),
 *   promoting modularity, reusability, and maintainability.
 * - Clear Separation of Concerns: Each class has a well-defined responsibility.
 *   `VersionContentStore` specifically handles the complex character-level data structure.
 * - Thorough Documentation: All classes, methods, and significant code blocks are documented
 *   using JSDoc to ensure clarity and ease of maintenance.
 * - Best Practices: Adherence to modern JavaScript best practices, including strict mode,
 *   efficient DOM manipulation, and robust error handling.
 * - Extensibility: Designed with future enhancements in mind (e.g., complex branching, merging,
 *   more sophisticated timeline, handling of multi-character changes like paste).
 * - User Experience: Focus on providing an intuitive and responsive user interface for core operations.
 *
 * Expected Code Quality:
 * - Readability: Code should be clean, well-formatted, and easy to understand.
 * - Maintainability: Modular design and comprehensive documentation facilitate ongoing maintenance and updates.
 * - Robustness: Includes error handling and validation to ensure stability.
 * - Efficiency: Optimized for performance where critical, especially in DOM manipulation and data processing related to text input.
 */

import { EditorManager } from './js/editorManager.js';
import { TimelineManager } from './js/timelineManager.js';
import { UIManager } from './js/uiManager.js';
import { VersionControl } from './js/versionControl.js';
// VersionContentStore is imported by VersionControl directly.

(function() {
  'use strict';

  /**
   * @class TimelineManager
   * @description Manages the rendering and interaction of the version history timeline.
   * This includes displaying branches, versions (nodes), and connections, and handling
   * user interactions on the timeline, such as navigating to a version or dragging.
   */
  // class TimelineManager { ... } // Entire class removed

  /**
   * @class StorageManager
   * @description Handles the persistence of version history and user preferences.
   * It can use localStorage for simple persistence or manage file export/import operations.
   */
  // class StorageManager { ... } // Entire class removed

  /**
   * @class UIManager
   * @description Manages global UI elements and interactions, such as buttons,
   * keyboard shortcuts, and modal dialogs. It orchestrates UI updates based on
   * VersionControl state changes and coordinates between different UI components.
   */
  // class UIManager { ... } // Entire class removed

  /**
   * @class VersionControl
   * @description The core logic unit for the version control system. It manages branches,
   * versions, and the relationships between them. It coordinates with EditorManager
   * for text changes, TimelineManager for history visualization, and StorageManager
   * for data persistence.
   */
  // class VersionControl { ... } // Entire class removed


  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    const editorId = 'editor';
    const timelineId = 'timeline-tree';
    const controlsContainerSelector = '.container';

    try {
      // Create manager instances
      // const storageManager = new StorageManager(); // Removed
      
      // Create managers with circular dependencies, which we'll resolve after creation
      let editorManager = new EditorManager(editorId, null);
      let timelineManager = new TimelineManager(timelineId, null);
      let uiManager = new UIManager(null, /* storageManager */ null, timelineManager); // Pass null for storageManager

      // Create version control as the central orchestrator
      let versionControl = new VersionControl(
        editorManager,
        timelineManager,
        /* storageManager */ null, // Pass null for storageManager
        uiManager
      );

      // Resolve circular dependencies by setting versionControl on managers
      editorManager.versionControl = versionControl;
      timelineManager.versionControl = versionControl;
      uiManager.versionControl = versionControl;

      // Set up UI controls and global listeners
      uiManager.setupControls(controlsContainerSelector);
      uiManager.initGlobalEventListeners();

      // Initialize version control system
      versionControl.init();

    } catch (error) {
      console.error('Failed to initialize Text Version Control:', error);
      // Display user-friendly error message
      const body = document.querySelector('body');
      if (body) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Error initializing application. See console for details.';
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.fontWeight = 'bold';
        body.insertBefore(errorDiv, body.firstChild);
      }
    }
  });

})();
