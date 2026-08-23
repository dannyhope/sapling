# Text Version Control
# sapling
Quick branches

A browser-based version control interface for text editing with an interactive timeline and branching support.

## Browser extension (Chrome/Chromium, Manifest V3)

Sapling can be loaded as a local browser extension. The toolbar popup includes an **Open Sapling** button that opens the full app (`v2/`) in a new tab.

### Load unpacked (local development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repo folder (the one containing `manifest.json`)

## Features

- Real-time recording of text edits in a textarea
- Interactive timeline visualization below the editor
- Branch creation when editing from a previous point in time
- Tree visualization of all branches
- Keyboard shortcuts for navigation
- Export and import of version history

## How to Use

1. Open `v2/index.html` in your browser (standalone), or use the extension’s **Open Sapling** button
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
