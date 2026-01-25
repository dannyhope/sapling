# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sapling is a browser-based text version control system with an interactive timeline and branching support. It tracks character-level changes to text content, visualises version history, and allows users to create branches by editing from previous points in time. The project is pure JavaScript with no external dependencies and uses localStorage for persistence.

**Current active version:** `v2/` (modular architecture)
**Legacy version:** `v1/` (monolithic)

## Running the Application

1. Open `v2/index.html` directly in a web browser (no build step required)
2. The application runs entirely client-side with no server dependencies
3. Data persists in browser localStorage (currently disabled in v2 - always initialises fresh)

## Architecture (v2)

The v2 codebase follows an **Object-Oriented Design** with clear separation of concerns:

### Core Classes

- **`VersionControl`** (`versionControl.js`): Central orchestrator managing branches, transactions, and version state. Implements the core version control logic including branch creation, undo/redo, and transaction application.

- **`EditorManager`** (`editorManager.js`): Handles textarea input/output and tracks character-level changes. Detects single character additions, deletions, and multi-character operations.

- **`TimelineManager`** (`timelineManager.js`): Orchestrates timeline visualisation by coordinating specialised timeline sub-components. Manages SVG rendering, node positions, and user interactions with the timeline.

- **`UIManager`** (`uiManager.js`): Manages global UI elements, keyboard shortcuts (Ctrl/Cmd+Z/Y for undo/redo, Ctrl/Cmd+B for branch creation), and status messages. Handles mouse events for timeline dragging.

- **`VersionContentStore`** (`versionContentStore.js`): Manages character-level history data structure. Maintains sparse array format tracking full history for each character slot (`['a', null, 'b']` = char 'a' deleted, replaced by 'b').

### Timeline Sub-Components (`js/timeline/`)

The timeline rendering is decomposed into focused modules:

- **`timelineBranchRenderer.js`**: Renders branch labels and nodes, calculates branch layout
- **`timelineNodeRenderer.js`**: Renders individual version nodes (circles) with visual states
- **`timelineConnectionRenderer.js`**: Renders connection lines between nodes and branches
- **`timelineSvgManager.js`**: Manages SVG canvas creation, clearing, and viewBox adjustment
- **`timelineDragHandler.js`**: Handles drag-and-drop interactions on timeline nodes
- **`timelineEventHandler.js`**: Coordinates timeline mouse/touch events
- **`timelineUtils.js`**: Utility functions (transform parsing, etc.)
- **`timelineConstants.js`**: Shared constants (SVG namespace, IDs, dimensions)

### Key Data Structures

**Branch Object:**
```javascript
{
  id: string,              // Branch identifier
  parentBranchId: string,  // Parent branch (null for main)
  parentTransactionIndex: number, // Index where branch forked (-1 for main)
  initialContent: string,  // Text state when branch was created
  transactions: Array      // Array of operation arrays [index, char] or [index, count]
}
```

**Transaction/Operation Arrays:**
- Add character: `[index, character_string]`
- Delete single: `[index]` (implies 1 character)
- Delete multiple: `[index, count]`

**State Identifier:**
```javascript
{
  branchId: string,
  index: number  // Transaction index (-1 = initialContent)
}
```

### Circular Dependencies

The architecture uses circular dependencies between `VersionControl`, `EditorManager`, `TimelineManager`, and `UIManager`. These are resolved in `app.js` by:
1. Creating instances with `null` for circular refs
2. Setting references after all instances exist
3. Calling `timelineManager.initializeDependentComponents()` after wiring

## Version Control Concepts

- **Transactions**: Individual character operations stored as compact arrays
- **Branches**: Created automatically when editing from a non-tip version, or manually via Ctrl/Cmd+B
- **Transaction Index**: `-1` represents a branch's `initialContent` state; `0+` are actual transactions
- **Text Reconstruction**: Branches store only `initialContent` + transaction log; text is reconstructed by applying operations

## Keyboard Shortcuts

- **Ctrl/Cmd + Z**: Undo (navigate to previous version)
- **Ctrl/Cmd + Shift + Z** or **Ctrl/Cmd + Y**: Redo (navigate to next version)
- **Ctrl/Cmd + B**: Create named branch from current version

## Configuration

`config.js` contains:
- `defaultTestDataFile`: Path to JSON file for loading test data (currently `null`)
- `debug`: Debug mode flag
- `maxBranchDepth`: Maximum branch depth (20)
- `autoSaveInterval`: Auto-save interval in ms (5000, currently unused as persistence is disabled)

## Important Implementation Details

1. **No Persistence in v2**: Storage functionality is commented out. The app always initialises with a fresh `main` branch. To re-enable, uncomment storage-related code in `versionControl.js` and restore `StorageManager` class.

2. **Character-Level Tracking**: Every character addition/deletion is tracked individually. Multi-character operations (paste, selection delete) are logged as single transactions with counts.

3. **Automatic Branching**: Editing from a non-tip version automatically creates a new branch with ID format `branch-{generated_id}`.

4. **Timeline Rendering**: Timeline uses SVG with dynamically calculated layouts. Node positions are tracked in `_nodePositions` map with composite keys `${branchId}_${index}`.

5. **JSDoc Documentation**: All classes and methods use JSDoc comments for API documentation.

## Project Structure

```
v2/
├── index.html           # Main HTML file
├── style.css            # Styles
├── config.js            # Configuration constants
├── app.js               # Entry point, initialisation, dependency resolution
└── js/
    ├── editorManager.js
    ├── timelineManager.js
    ├── uiManager.js
    ├── versionControl.js
    ├── versionContentStore.js
    └── timeline/
        ├── timelineBranchRenderer.js
        ├── timelineConnectionRenderer.js
        ├── timelineConstants.js
        ├── timelineDragHandler.js
        ├── timelineEventHandler.js
        ├── timelineNodeRenderer.js
        ├── timelineSvgManager.js
        └── timelineUtils.js
```

## Testing

The project has no formal test suite. Manual testing is performed by:
1. Opening `v2/index.html` in a browser
2. Following user stories in `user-stories.md` (Gherkin scenarios)
3. Checking browser console for errors
4. Observing raw storage display at bottom of page (shows internal branch data structure)

## Notable Commented Code

The v2 codebase has significant commented-out code:
- `StorageManager` class and all storage/persistence methods
- localStorage load/save operations
- User preference persistence
- Export/import functionality (scaffolded but not implemented)

This was intentionally disabled during refactoring. If re-enabling persistence, search for `// Removed` comments in `versionControl.js` and `app.js`.
