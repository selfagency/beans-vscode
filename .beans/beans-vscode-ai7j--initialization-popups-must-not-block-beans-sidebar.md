---
# beans-vscode-ai7j
title: Initialization popups must not block Beans sidebar loading
status: completed
type: bug
priority: high
created_at: 2026-02-17T12:50:35Z
updated_at: 2026-02-17T12:51:47Z
---

## Problem
Initialization popups (including create-instructions prompts) can prevent or delay Beans sidebar from loading.

## Expected
- Sidebar views should initialize and load regardless of prompt interactions.
- Prompts/instruction generation should be non-blocking and fire asynchronously.

## Tasks
- [x] Identify blocking activation/init flow
- [x] Refactor popup/instructions flow to non-blocking path
- [x] Add/update tests for non-blocking behavior
- [x] Verify compile/tests pass

## Summary of Changes
- Fixed activation blocking by making Copilot instruction/skill prompt-and-generation run asynchronously after sidebar registration, instead of awaiting inside activation/init flows.
- Added a re-entrancy guard (`aiArtifactSyncInProgress`) to avoid duplicate artifact sync prompts/runs.
- Updated all relevant call sites (startup when initialized, manual `beans.init`, and init prompt flow) to use non-blocking trigger.
- Added integration regression test proving activation resolves even when the create-instructions popup is left unanswered.
- Verified targeted integration tests and compile (typecheck + lint + build).
