---
# beans-vscode-v4tm
title: Interactive checklists in details view
status: todo
type: feature
priority: normal
created_at: 2026-02-18T05:17:09Z
updated_at: 2026-02-18T21:16:07Z
---

## Goal

Render checklist items inside the details view as real `<input type="checkbox">` elements instead of raw `- [ ]` / `- [x]` markdown literals. When a checkbox is toggled, update the corresponding line in the bean's markdown file on disk without requiring a manual save.

## Behaviour

- `- [ ] item` renders as an unchecked checkbox + label
- `- [x] item` renders as a checked checkbox + label
- Toggling a checkbox posts a message to the extension host with the line index and new checked state
- The extension host reads the bean's file, flips the relevant `[ ]` / `[x]` token, writes the file back, and refreshes the bean in memory (no full reload of the webview)
- Undo/redo should work via VS Code's normal file-edit stack if edits are applied through a `WorkspaceEdit`

## Acceptance criteria

- [ ] Checklist items look visually distinct from normal list items (checkbox control visible)
- [ ] Checking/unchecking persists to the markdown file immediately
- [ ] No stale state: re-opening the details view reflects the current file state
- [ ] Works when multiple checklist items exist in the same bean body
- [ ] Existing non-checklist list items (`- item`) are unaffected
- [ ] No regression on existing body rendering (bold, italic, code, links, bean-refs)

## Implementation notes

- Extend `renderMarkdown()` in `BeansDetailsViewProvider` to detect `/^- \[( |x)\] /` and emit `<li class="checklist-item"><input type="checkbox" data-line="N" ...>` instead of plain `<li>`
- Add a message handler in the webview script that listens for checkbox `change` events and calls `vscode.postMessage({ command: 'toggleChecklist', lineIndex: N, checked: bool })`
- Add a `handleToggleChecklist` branch in the `_onDidReceiveMessage` / message handler in the provider
- Use `vscode.workspace.fs` + `WorkspaceEdit` to patch the single line in the file
- Call `beansService.reloadBean()` (or invalidate cache) after write so the in-memory model stays consistent
