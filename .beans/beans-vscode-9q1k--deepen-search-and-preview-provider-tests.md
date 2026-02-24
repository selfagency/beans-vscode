---
# beans-vscode-9q1k
title: Deepen Search and Preview provider tests
status: scrapped
type: task
priority: high
created_at: 2026-02-17T03:20:10Z
updated_at: 2026-02-24T16:05:54Z
---

Increase test depth for provider webview and rendering behavior:

- Add DOM-level tests for search webview inline script behavior (debounce, keyboard, message rendering).
- Add stronger preview markdown snapshot coverage with deterministic locale/time controls.
- Validate escaping and unusual content edge cases across search and preview output.
