---
# beans-vscode-t4hi
title: Fix init/AI prompts and default view ordering
status: completed
type: bug
priority: high
branch: feature/beans-vscode-t4hi-init-ai-prompts-view-order
pr: 46
created_at: 2026-02-19T15:07:14Z
updated_at: 2026-02-19T15:07:14Z
---

## Todo
- [x] Locate activation flow for Beans initialization and AI/Copilot prompts
- [x] Ensure workspace without `.beans` prompts for consent before initialization
- [x] Ensure AI enablement prompt appears before Copilot instructions prompt
- [x] Update default sidebar ordering so Drafts appears above Open
- [x] Update default sidebar ordering so Search appears above Details
- [x] Add or update tests for activation and view ordering behavior
- [x] Run compile/tests and verify no regressions

## Summary of Changes
- Added startup marker checks so workspaces without `.beans`/`.beans.yml` are treated as uninitialized and users are prompted before initialization.
- Added AI enablement consent prompt before Copilot artifact generation prompt, with workspace preference handling.
- Locked default sidebar order via view contribution `order` values so Drafts appears above Open and Search appears above Details.
- Updated integration tests for activation/prompt behavior and validated with targeted Vitest runs plus compile.
