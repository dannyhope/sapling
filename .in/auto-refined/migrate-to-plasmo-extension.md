# Migrate Sapling to Plasmo Browser Extension

## Overview

Migrate Sapling (text version control system) from standalone JavaScript app to a Plasmo browser extension with **content script integration** that injects version control UI into textareas on any web page.

**Stack:** Plasmo + React + TypeScript + shadcn/ui + Tailwind

**Strategy:** Port core algorithms, rebuild UI with React components

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PLASMO BROWSER EXTENSION                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  POPUP UI              BACKGROUND SERVICE WORKER       │
│  - Settings            - Storage coordination           │
│  - Enable/Disable      - Command API handlers           │
│  - Export/Import       - Badge updates                  │
│                                                         │
│                CONTENT SCRIPT (injected per tab)       │
│                ┌──────────────────────────────────┐    │
│                │  TextareaDetector                │    │
│                │  - Find all textareas            │    │
│                │  - Create VC instance per field  │    │
│                └──────────────────────────────────┘    │
│                                                         │
│                ┌──────────────────────────────────┐    │
│                │  SaplingOverlay.tsx (CSUI)       │    │
│                │  Rendered in Shadow DOM:         │    │
│                │    <TimelinePanel>               │    │
│                │      <TimelineSvg />             │    │
│                │      <ControlBar />              │    │
│                │    </TimelinePanel>              │    │
│                └──────────────────────────────────┘    │
│                                                         │
│                ┌──────────────────────────────────┐    │
│                │  Core Services (TypeScript)      │    │
│                │  - VersionControlService         │    │
│                │  - TextareaMonitor               │    │
│                │  - StorageService (chrome API)   │    │
│                └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

HOST WEB PAGE
  <textarea> ◄── Monitored, each gets own VC + overlay
```

---

## Project Structure

```
plasmo-sapling/
├── src/
│   ├── popup.tsx                          # Extension popup
│   ├── background/
│   │   └── index.ts                       # Service worker
│   ├── contents/
│   │   └── sapling-overlay.tsx            # CSUI (injected into pages)
│   │
│   ├── core/                              # Migrated logic (TypeScript)
│   │   ├── types/
│   │   │   ├── branch.ts                  # Branch, BranchMap interfaces
│   │   │   ├── transaction.ts             # Transaction types
│   │   │   └── state.ts                   # StateIdentifier
│   │   ├── services/
│   │   │   ├── VersionControlService.ts   # Port of versionControl.js
│   │   │   ├── TextareaMonitorService.ts  # Port of editorManager.js
│   │   │   ├── StorageService.ts          # chrome.storage wrapper
│   │   │   └── TextareaDetector.ts        # Multi-textarea detection
│   │   └── utils/
│   │       ├── textReconstruction.ts      # Text rebuild algorithm
│   │       └── idGenerator.ts
│   │
│   ├── components/                        # React components
│   │   ├── timeline/
│   │   │   ├── Timeline.tsx
│   │   │   ├── TimelineSvg.tsx
│   │   │   ├── TimelineNode.tsx           # Individual node (circle)
│   │   │   ├── TimelineBranch.tsx
│   │   │   ├── TimelineConnection.tsx
│   │   │   └── useTimelineLayout.ts       # Layout calculation hook
│   │   ├── controls/
│   │   │   ├── ControlBar.tsx
│   │   │   ├── BranchDialog.tsx           # shadcn Dialog
│   │   │   └── ExportImportButtons.tsx
│   │   └── overlay/
│   │       ├── SaplingPanel.tsx           # Floating panel container
│   │       └── MinimizedIndicator.tsx
│   │
│   ├── hooks/
│   │   ├── useVersionControl.ts           # Manages VC service
│   │   ├── useTextareaMonitor.ts          # Monitors textarea changes
│   │   ├── useKeyboardShortcuts.ts        # Undo/redo/branch shortcuts
│   │   └── useTimelineDrag.ts             # Drag-to-navigate
│   │
│   ├── state/
│   │   └── VersionControlContext.tsx      # React Context for VC
│   │
│   ├── styles/
│   │   ├── globals.css                    # Tailwind imports
│   │   ├── content.css                    # Shadow DOM styles
│   │   └── timeline.css
│   │
│   └── lib/
│       └── utils.ts                       # shadcn/ui utilities
│
└── components.json                        # shadcn/ui config
```

---

## Core TypeScript Interfaces

```typescript
// src/core/types/branch.ts
export interface Branch {
  id: string;
  parentBranchId: string | null;
  parentTransactionIndex: number;
  initialContent: string;
  transactions: Transaction[];
}

// src/core/types/transaction.ts
export type TransactionAdd = [index: number, char: string];
export type TransactionDeleteSingle = [index: number];
export type TransactionDeleteMulti = [index: number, count: number];
export type Transaction = TransactionAdd | TransactionDeleteSingle | TransactionDeleteMulti;

export enum OperationType {
  ADD = 'charTyped',
  DELETE = 'charDeleted',
  DELETE_MULTI = 'charsDeleted',
  INITIAL = 'initial',
  BRANCH_CREATED = 'branch_created',
}

// src/core/types/state.ts
export interface StateIdentifier {
  branchId: string;
  index: number;  // -1 for initialContent
}

// src/core/types/storage.ts
export interface MonitoredTextarea {
  element: HTMLTextAreaElement;
  uniqueId: string;
  vcInstance: VersionControlService;
  overlayMounted: boolean;
}
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Migration (Week 1-2) 🔴 CRITICAL PATH

**1.1 Initialize Plasmo Project**
```bash
pnpm create plasmo plasmo-sapling
cd plasmo-sapling
pnpm install
# Add dependencies
pnpm add @plasmohq/storage @plasmohq/messaging
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog input label tooltip
```

**1.2 Port Core Logic to TypeScript** ⬅️ HIGHEST PRIORITY

Port **v2/js/versionControl.js** (715 lines) → **src/core/services/VersionControlService.ts**
- Keep all algorithms: text reconstruction (lines 176-227), branching (305-323), undo/redo (449-488)
- Convert to class with **observable pattern** (subscribe/notify for React integration)
- Add TypeScript types throughout
- Remove DOM dependencies (no direct EditorManager/TimelineManager calls)
- Emit state changes via callbacks instead

Key methods to preserve:
- `_reconstructText()` - Pure algorithm, extract to utility
- `_commitTransaction()` - Core operation append logic
- `createBranch()` - Auto-branching when editing from past
- `undo()` / `redo()` - State navigation
- `switchToVersion()` - Jump to any state

Create **src/core/services/StorageService.ts** wrapping `chrome.storage.local`
- Replace localStorage with async chrome API
- Scope storage by textarea ID + domain

---

### Phase 2: Content Script Foundation (Week 2-3)

**2.1 Textarea Detection**
Build **src/core/services/TextareaDetector.ts**
```typescript
class TextareaDetector {
  // Query all textareas on page load
  // Use MutationObserver for dynamically added textareas
  // Generate unique IDs (hash based on position/attributes)
  // Return Map<textareaId, MonitoredTextarea>
}
```

**2.2 Textarea Monitoring**
Port **v2/js/editorManager.js** → **src/core/services/TextareaMonitorService.ts**
- Keep character detection logic (lines 38-69: input event, 76-103: keydown)
- Emit events instead of calling VC directly
- Handle selection deletions, paste operations
- Remove textarea ownership (pass element as parameter)

Critical logic to port:
```javascript
// Lines 54-66: Single character detection
const diff = newValue.length - oldValue.length;
if (diff === 1) {
  // Find insertion index by comparing strings
  // Call recordCharacterTyped(index, char)
}
```

---

### Phase 3: React Timeline Components (Week 3-4) 🔴 MOST COMPLEX

**3.1 Timeline Infrastructure**
Create **src/components/timeline/useTimelineLayout.ts**
- Port position calculation from **v2/js/timeline/timelineNodeRenderer.js** (lines 37-112)
- Calculate branch Y offsets, node X positions
- Return `Map<"${branchId}_${index}", {x, y}>`

**3.2 Timeline Visual Components**

Port SVG rendering from imperative DOM manipulation to declarative React:

**Timeline.tsx** - Main orchestrator (port from timelineManager.js orchestration pattern)
**TimelineSvg.tsx** - SVG container with viewBox
**TimelineNode.tsx** - Individual circles
```tsx
<circle
  cx={position.x}
  cy={position.y}
  r={isActive ? 6 : 4}
  fill={getColorForOp(operationType)}
/>
```

**TimelineBranch.tsx** - Maps over transactions
**TimelineConnection.tsx** - Bezier curves between branches

Key files to reference:
- **v2/js/timelineManager.js** - Orchestration pattern (lines 98-133: render flow)
- **v2/js/timeline/timelineNodeRenderer.js** - Node rendering + position math
- **v2/js/timeline/timelineBranchRenderer.js** - Branch layout
- **v2/js/timeline/timelineConnectionRenderer.js** - SVG paths

---

### Phase 4: Controls & Context (Week 4-5)

**4.1 Control Bar**
**src/components/controls/ControlBar.tsx** with shadcn components
- Undo/Redo buttons (call context actions)
- Branch creation (opens BranchDialog)
- Export/Import

**4.2 Version Control Context**
**src/state/VersionControlContext.tsx**
```typescript
interface VersionControlContextType {
  branches: BranchMap;
  currentBranchId: string;
  currentTransactionIndex: number;

  recordCharTyped: (index: number, char: string) => void;
  undo: () => void;
  redo: () => void;
  createBranch: (name: string) => void;
  switchToVersion: (branchId: string, index: number) => void;
}
```

**4.3 Floating Panel**
**src/components/overlay/SaplingPanel.tsx**
- Draggable, minimizable panel
- Shadow DOM styling isolation (Plasmo handles this)
- Renders Timeline + ControlBar

---

### Phase 5: Content Script Integration (Week 5-6)

**5.1 Create Plasmo CSUI**
**src/contents/sapling-overlay.tsx**
```typescript
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export default function SaplingOverlay() {
  return (
    <VersionControlProvider textareaElement={targetTextarea}>
      <SaplingPanel />
    </VersionControlProvider>
  )
}
```

**5.2 Wire Everything Together**
- TextareaDetector finds all textareas
- Each gets own VC service instance + overlay
- TextareaMonitor syncs changes to VC
- Keyboard shortcuts: useKeyboardShortcuts hook (Cmd+Z, Cmd+Y, Cmd+B)
- Timeline drag: useTimelineDrag hook

**5.3 Handle Multiple Textareas**
- One overlay instance per textarea
- Scope storage by textareaId
- Plasmo anchor config to position near each textarea

---

### Phase 6: Extension Features (Week 6)

**6.1 Background Service Worker**
**src/background/index.ts**
- chrome.commands API for keyboard shortcuts
- Badge updates (count of tracked textareas)

**6.2 Popup UI**
**src/popup.tsx** (shadcn components)
- Enable/disable for current domain
- View tracked textareas
- Global export/import
- Clear history

---

### Phase 7: Testing (Week 7-8)

**Unit Tests** (Vitest)
- Test VersionControlService methods
- Test text reconstruction algorithm
- Test undo/redo cycles

**Manual Testing**
- [ ] Gmail compose window
- [ ] GitHub issue/PR comments
- [ ] Notion pages
- [ ] Multiple textareas on one page
- [ ] Page reload persistence
- [ ] Large version trees (100+ transactions)
- [ ] Export/import functionality

---

## Migration Strategy: Port vs Rebuild

### PORT (Preserve Working Logic) ✅

**versionControl.js** → **VersionControlService.ts**
- Text reconstruction algorithm (pure, complex)
- Branch creation logic
- Transaction commit logic
- Undo/redo navigation
- **Strategy:** Direct TypeScript port + add types + observable pattern

**editorManager.js** → **TextareaMonitorService.ts**
- Character-level change detection (lines 38-120)
- **Strategy:** Port with minimal changes, emit events

### REBUILD (React/Modern Patterns) 🔨

**Timeline rendering** (timelineManager.js + 7 sub-components)
- **Current:** Imperative SVG DOM manipulation
- **New:** Declarative React components with JSX
- Extract layout calculations to useTimelineLayout hook

**UI controls** (uiManager.js)
- **Current:** Manual DOM, prompt() dialogs
- **New:** shadcn/ui components (Button, Dialog, Toast)

**Storage** (storageManager.js)
- **Current:** localStorage
- **New:** chrome.storage.local (async)

---

## Critical Files to Reference

1. **v2/js/versionControl.js** (715 lines) - Core logic, must port carefully
2. **v2/js/editorManager.js** - Character detection (lines 38-120)
3. **v2/js/timelineManager.js** - Orchestration pattern (lines 61-133)
4. **v2/js/timeline/timelineNodeRenderer.js** - Position calculation (lines 37-112)
5. **v2/app.js** - Circular dependency resolution (lines 94-123)

---

## Key Decisions

1. **One VC instance per textarea** - Isolation, simpler than shared state
2. **React Context not Zustand** - Simpler for isolated use case
3. **Shadow DOM** - Plasmo's built-in CSS isolation
4. **chrome.storage.local not sync** - Large data, per-device
5. **Port core algorithms, rebuild UI** - Preserve logic, modernize presentation

---

## Estimated Timeline

**Total: 7-8 weeks**

Critical path: Core services → Textarea monitoring → Timeline components → Integration

**Biggest Risks:**
- Timeline performance with large trees (mitigation: useMemo, virtualization)
- Shadow DOM CSS conflicts (mitigation: Tailwind with prefix)
- Storage size limits (mitigation: per-domain quotas, pruning)

## Auto-investigation
**Investigated:** 2026-02-09

### Findings
- Task requires detailed investigation during interactive refinement
- Context and codebase research needed to understand scope
- Auto-investigation performed as batch processing during `/refine auto`

### Scope
- To be determined during interactive refinement
- **Estimated complexity:** Unknown pending investigation

### Questions for refinement
- Will be identified during interactive `/refine` session

### Dependencies
- To be determined
