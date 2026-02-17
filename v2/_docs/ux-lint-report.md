# UX Lint Report – Sapling v2

**Date:** 2026-02-17
**Version:** v2
**Audited files:** `index.html`, `style.css`, `js/uiManager.js`, `js/editorManager.js`

---

## Executive Summary

Sapling v2 is a functional text version control interface with solid core interactions (undo/redo, branching, timeline visualization). However, several UX issues reduce usability and accessibility. The most critical gaps are:

1. **Placeholder text masking help content** – violates UI standards
2. **Insufficient touch target sizes** – buttons fail WCAG 2.5.5 (44×44px minimum)
3. **No visible status feedback** – users don't see when actions succeed/fail
4. **Missing keyboard shortcut reference** – powerful shortcuts are undiscoverable
5. **Debug panel visible in production UI** – clutters the interface

---

## 🔴 Critical Issues

### 1. **Placeholder as Hint Text (Not Valid Help)**
- **Current:** Textarea uses placeholder `"Start typing here..."`
- **Problem:** Placeholder disappears on focus, leaving no visible instruction. Users unfamiliar with the app won't know what to do. Violates UX guideline: "Form field tips in placeholders should be visible text instead."
- **Recommendation:** Add a visible label or hint paragraph above the textarea:
  ```html
  <label for="editor">Edit your text</label>
  <p class="hint">Start typing to record changes. Use Ctrl+Z to undo, Ctrl+B to branch.</p>
  ```
- **Rule violated:** Clickable Element Standards / Form Control Hints

### 2. **Button Touch Targets Too Small**
- **Current:** All buttons are 32px tall (Export History, Import History, New Branch)
- **Problem:** WCAG 2.5.5 and mobile UX guidelines require at least 44×44px touch targets. 32px buttons are too small and cause mis-taps.
- **Recommendation:** Increase button padding: `padding: 12px 16px;` (or `padding: 10px 16px;` minimum)
- **Affected elements:** `.control-btn`
- **Rule violated:** Clickable Element Standards / Mobile & Responsive Design

### 3. **No Visible Status Feedback**
- **Current:** Status messages are logged to browser console only (`console.log` in UIManager)
- **Problem:** Users don't see confirmation when they create a branch, label a version, or import/export history. Actions feel unresponsive.
- **Recommendation:**
  1. Add a visible status area to HTML:
     ```html
     <div id="status-message" role="status" aria-live="polite"></div>
     ```
  2. Update UIManager.displayMessage() to show messages in this element with auto-fade
  3. Provide visual feedback (colour-coded: success=green, error=red, info=blue)
- **Rule violated:** Visibility of System Status (Nielsen Heuristic #1) / Autosave Feedback

---

## 🟠 Medium Issues

### 4. **No Keyboard Shortcuts Reference**
- **Current:** Shortcuts exist (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+B, Ctrl+L) but are not documented in the UI
- **Problem:** Power users can't discover shortcuts; less efficient workflows
- **Recommendation:**
  1. Add a "?" button or menu item that shows a shortcuts overlay/modal
  2. Document shortcuts with their functions:
     - `Ctrl/Cmd + Z` – Undo
     - `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` – Redo
     - `Ctrl/Cmd + B` – Create branch
     - `Ctrl/Cmd + L` – Label version
  3. Make the reference dismissible and toggle-able
- **Rule violated:** Keyboard Shortcuts / Help and Documentation

### 5. **Debug Panel Visible in Main UI**
- **Current:** "Raw Storage Content" section with JSON data is displayed prominently at the bottom of the page
- **Problem:** This is a developer debugging tool that should not be visible to end users. It clutters the interface and reveals implementation details.
- **Recommendation:**
  1. Hide by default: `.raw-storage-container { display: none; }` or move to dev tools
  2. Add a "Show Debug Panel" toggle (accessible via `?` or settings menu)
  3. Or move to a separate dev view (e.g., `debug.html`)
- **Rule violated:** Aesthetic and Minimalist Design (Nielsen Heuristic #8)

### 6. **No Accessible Tooltips**
- **Current:** Interactive elements have no `title` attributes or native tooltips
- **Problem:** Hoverable elements (timeline nodes, buttons) provide no affordance or explanation on hover
- **Recommendation:** Add `title` attributes:
  ```html
  <button title="Export version history as JSON">Export History</button>
  <circle class="timeline-node" title="Version 5: 'Hello world'"></circle>
  ```
- **Rule violated:** Clickable Element Standards / Tips and Help Text

### 7. **No Theme/Dark Mode Picker**
- **Current:** Interface is light-only; no theme selector
- **Problem:** No respect for user OS preference (System, Light, Dark modes)
- **Recommendation:**
  1. Add a theme picker in a settings area or header:
     ```html
     <select id="theme-selector" aria-label="Select theme">
       <option value="system">System</option>
       <option value="light">Light</option>
       <option value="dark">Dark</option>
     </select>
     ```
  2. Detect system preference with `prefers-color-scheme` media query
  3. Persist selection to localStorage
- **Rule violated:** Theme Picker (Appearance)

### 8. **Timeline Nodes Lack Sufficient Visual Feedback on Hover**
- **Current:** Timeline SVG nodes are clickable but have no hover tooltip or visual change
- **Problem:** Users can't easily tell what each node represents or when they're hovering over a clickable element
- **Recommendation:**
  1. Add hover tooltips showing version info: `"Version 3: 'Hello wor'"` (truncated content preview)
  2. Highlight the node or show a border on hover
  3. Cursor should be `pointer` (already implemented ✓)
- **Rule violated:** Recognition Rather Than Recall / Clickable Element Standards

---

## 🟢 Minor Issues

### 9. **Button Text Casing**
- **Current:** Buttons use Title Case ("Export History", "Import History", "New Branch")
- **Problem:** Modern UX guideline prefers Sentence Case. Title Case feels formal and dated.
- **Recommendation:** Change to Sentence Case: "Export history", "Import history", "New branch"
- **Rule violated:** Button Text Casing

### 10. **No Escape Key Handling for Dialogs**
- **Current:** When prompted to enter branch name or label, there's no documented Escape key behavior
- **Problem:** Keyboard users expect Escape to cancel a prompt
- **Recommendation:** Document that Escape cancels the prompt (this is browser default, but not obvious to users)
- **Rule violated:** Escape Key Progressive Dismissal

### 11. **Raw Storage Display Could Be Abbreviated**
- **Current:** Shows full JSON structure for all branches
- **Problem:** Large displays are hard to scan; no abbreviation markup for technical terms
- **Recommendation:** Add abbreviation markup for JSON keys:
  ```html
  <abbr title="Portable Document Format">PDF</abbr>
  ```
- **Rule violated:** Abbreviations

### 12. **No Keyboard Focus Indicators**
- **Current:** Buttons and textarea may not have visible focus outlines (depends on browser default)
- **Problem:** Keyboard navigation users can't tell which element has focus
- **Recommendation:** Add explicit focus styles to CSS:
  ```css
  button:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }
  textarea:focus-visible {
    outline: 2px solid var(--blue);
  }
  ```
- **Rule violated:** Keyboard Shortcuts / Accessibility

---

## ✅ Good Practices Observed

1. **Responsive Viewport Meta Tag** – Correctly configured: `width=device-width, initial-scale=1.0`
2. **No Horizontal Overflow** – Content reflows properly at mobile widths (375px tested)
3. **Adequate Font Size** – Body text is 16px on mobile (avoids iOS auto-zoom trigger)
4. **Textarea Touch Target** – 100px tall (well above 44px minimum)
5. **Keyboard Shortcuts Implemented** – Undo/redo/branch creation are keyboard-accessible
6. **Brand Colours** – Thoughtful colour palette with semantic meanings (green = success, red = error, etc.)
7. **SVG Timeline** – Efficient vector rendering for version history visualization
8. **Semantic HTML** – Basic structure is valid and accessible

---

## Summary by Severity

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Critical | 3 | Placeholder text, button sizes, no status feedback |
| 🟠 Medium | 5 | No shortcuts ref, debug panel visible, no tooltips, no dark mode, no hover feedback |
| 🟢 Minor | 4 | Button casing, Escape behavior, abbreviations, focus indicators |

---

## Implementation Priority

**Phase 1 (Critical – high impact, quick fixes):**
1. Replace placeholder with visible label + hint
2. Increase button padding to 44×44px minimum
3. Add visible status message area with auto-fade

**Phase 2 (Medium – improves polish and discoverability):**
4. Add "?" shortcut reference overlay
5. Hide debug panel by default; add toggle
6. Add tooltips to interactive elements
7. Add theme picker

**Phase 3 (Nice to have):**
8. Fix button text casing
9. Document Escape key behavior
10. Add focus indicators
11. Add version previews in timeline tooltips

---

## Testing Recommendations

- **Keyboard-only users:** Can they access all features without a mouse?
- **Mobile users:** Can they tap buttons accurately at 44×44px minimum?
- **Screen reader users:** Do status messages announce changes?
- **Low vision users:** Is there sufficient colour contrast? (check with WCAG contrast checker)
- **Internationalization:** Will visible labels work in long languages?

---

## References

- [WCAG 2.5.5 – Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Nielsen's 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Apple Human Interface Guidelines – Status & Feedback](https://developer.apple.com/design/human-interface-guidelines/)
- [GOV.UK Form Labels and Help Text](https://design-system.service.gov.uk/components/text-input/)
