---
# beans-vscode-y4k2
title: Deepen extension activation integration tests
status: scrapped
type: task
priority: high
created_at: 2026-02-17T03:29:40Z
updated_at: 2026-02-24T16:05:47Z
---

Expand extension activation test depth with fewer mocks and more realistic wiring:

- Exercise activate/deactivate flows with real provider classes and controlled service fakes.
- Validate command registration effects and event wiring using actual callbacks.
- Add end-to-end checks for watcher debounce/config-change behavior and init prompt session state.
