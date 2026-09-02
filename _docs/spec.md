# Sapling — Product Spec

> Living document. Update whenever behaviour changes. Last updated: 2026-08-28.
>
> **This file is the source of truth for how Sapling should work.**

Sapling is a **text version control** tool: it records edits to a document, lets you move through history, and creates **branches** when you edit from an earlier point.

This repo contains the core Sapling app (currently `v2/`) and a Chrome/Chromium **Manifest V3** extension wrapper.

## Extension surfaces

### Popup

- Shows a short description and an **Open Sapling** button.
- Clicking **Open Sapling** opens the full Sapling app in a new browser tab (an extension page) and closes the popup.
- Footer attribution: “A Danny Hope product”.

### Full app (tab)

- The full app is `v2/index.html`.
- It provides:
  - A textarea editor
  - Timeline + branching visualisation
  - Undo/redo via keyboard shortcuts
  - Export/import of history (JSON)

## Data & privacy

- Sapling stores data **locally in the browser** (no server).
- No analytics, tracking, or network requests are required for core function.

## Local development

The app can be served locally for browser development at
`http://sapling.local/v2/`. `scripts/start-dev.sh` ensures the committed
hostname resolves to `127.0.0.1`, selects the preferred port in `.dev-port`
(falling back if busy), and starts the HTTP server on loopback. The shared
Bombay port-80 proxy owns the portless URL and must route
`sapling.local` to the actual selected development port; it is not configured
or replaced by this repository.

## Non-goals (current shipping scope)

- No page injection / overlays on third-party sites (content scripts) yet.
- No collaboration / sync between devices.

## Accessibility

Sapling is an unpublished personal project; no formal accessibility level has
yet been selected. Keep native controls, keyboard shortcuts, focus states, and
colour-independent status cues usable as the interface evolves.

