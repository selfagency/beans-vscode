---
# beans-vscode-q9cy
title: Release on tag only after main checks pass
status: in-progress
type: bug
priority: high
created_at: 2026-02-17T16:07:41Z
updated_at: 2026-02-17T16:37:22Z
---

Run CI and Remote tests in parallel again, and on tag push only release when required workflows have succeeded on the latest commit on main.

## Summary of Changes

- Restored CI and Remote Compatibility Tests to parallel execution on push/PR (no workflow chaining).
- Changed Release workflow trigger to tag push and added strict gate: release only if tag points to latest main commit.
- Added required-check verification in release detector for latest main SHA: both 'CI' and 'Remote Compatibility Tests' must be successful.
- Preserved devcontainer GHCR push fix and updated conditions for push/PR events.

## Follow-up\n\nFix release gate to resolve annotated tag refs to commit SHA before comparing against latest main.
