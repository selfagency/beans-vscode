---
# beans-vscode-8ixw
title: Fix CI test failures in extension-lifecycle integration test
status: completed
type: bug
priority: normal
created_at: 2026-02-17T19:26:37Z
updated_at: 2026-02-17T19:27:00Z
---

The extension-lifecycle.test.ts integration test was failing because the mock for ../../beans/config was missing required constant exports (COPILOT_INSTRUCTIONS_RELATIVE_PATH and COPILOT_SKILL_RELATIVE_PATH).

When the extension tried to access these constants during the init prompt test, Vitest threw an error that was caught and swallowed by the try-catch in triggerCopilotAiArtifactSync, preventing the Copilot artifact generation prompt from ever being shown.

Fixed by:
1. Adding missing constant exports to the config mock in extension-lifecycle.test.ts
2. Resetting aiArtifactSyncInProgress flag in deactivate() to prevent state leakage between tests
3. Improving afterEach timer handling to safely work with both fake and real timers

All 410 tests now pass.
