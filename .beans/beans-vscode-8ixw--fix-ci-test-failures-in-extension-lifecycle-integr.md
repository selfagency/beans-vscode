---
# beans-vscode-8ixw
title: Fix CI test failures in extension-lifecycle integration test
status: completed
type: bug
priority: normal
created_at: 2026-02-17T19:26:37Z
updated_at: 2026-02-17T19:53:11Z
---

The extension-lifecycle.test.ts integration test was failing because the mock for ../../beans/config was missing required constant exports (COPILOT_INSTRUCTIONS_RELATIVE_PATH and COPILOT_SKILL_RELATIVE_PATH).

When the extension tried to access these constants during the init prompt test, Vitest threw an error that was caught and swallowed by the try-catch in triggerCopilotAiArtifactSync, preventing the Copilot artifact generation prompt from ever being shown.

Fixed by:
1. Adding missing constant exports to the config mock in extension-lifecycle.test.ts
2. Resetting aiArtifactSyncInProgress flag in deactivate() to prevent state leakage between tests
3. Improving afterEach timer handling to safely work with both fake and real timers

All 410 tests now pass.



Note: The initial commit (86e5088) only changed the test prompt handling but did not include the critical fixes. The actual fix was in commit 4156491 which:
- Added the missing constants to the mock
- Reset module state in deactivate()
- Improved timer handling
- Changed to real timers with polling for the problematic test



Follow-up fixes:
- Fixed shell syntax error in release workflow version sync step (was trying to parse node require() calls)
- Removed tag trigger from CodeQL workflow to avoid unnecessary runs on version tags



Additional workflow fixes:
- Combined version and changelog updates into single step to ensure both are committed together
- After committing, tag is moved forward to new commit so package/release uses updated files
- Removed duplicate version sync step
- Fixed duplicate changelog in GitHub releases by using pre-generated notes instead of auto-generation
