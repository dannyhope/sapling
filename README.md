# sapling
Quick branches

A browser-based version control interface for text editing with an interactive timeline and branching support.

## Features

- Real-time recording of text edits in a textarea
- Interactive timeline visualization below the editor
- Branch creation when editing from a previous point in time
- Tree visualization of all branches
- Keyboard shortcuts for navigation
- Export and import of version history

## How to Use

1. Open `index.html` in your browser
2. Start typing in the editor - changes are automatically recorded
3. Use the timeline below to navigate between versions
4. When you navigate to a previous version and make edits, a new branch is created
5. Use keyboard shortcuts for faster navigation:
   - `Ctrl/⌘+Z`: Navigate to previous version
   - `Ctrl/⌘+Shift+Z`: Navigate to next version
   - `Ctrl/⌘+B`: Create a named branch

## Implementation Details

- Pure JavaScript with no external dependencies
- Uses localStorage for persistent storage between sessions
- Responsive design works on desktop and tablet devices

## Build Information

Last built on Friday the 4th of April, 2025 at 12:59PM
