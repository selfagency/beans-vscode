---
# beans-vscode-s5ll
title: Ask consent before generating Copilot files
status: completed
type: bug
priority: high
created_at: 2026-02-17T06:52:20Z
updated_at: 2026-02-17T07:16:23Z
---

## Problem\nBeans integration generated files in the repository without explicit user confirmation:\n- .github/instructions/beans.instructions.md\n- .github/skills/beans/SKILL.md\n\n## Expected behavior\nBefore writing or updating generated Copilot instruction/skill files, prompt the user for explicit confirmation (opt-in) for the current workspace/repo.\n\n## Actual behavior\nFiles were generated automatically during extension activation/workspace initialization without asking first.\n\n## Why this is a bug\nThis creates unexpected repository changes and can disrupt clean working trees and release flows.\n\n## Suggested fix\nAdd a confirmation prompt before first-time generation in a workspace, with options:\n- Generate now\n- Not now\n- Never for this workspace (setting)\n\nAlso log/telemetry should clearly indicate when generation is skipped due to user choice.

## Summary of Changes
- Added explicit opt-in prompt before generating Copilot artifacts.
- Updated choices to: Generate now, Not now, Never for this workspace.
- Persisted workspace opt-out preference and added logging for generate/skip/never decisions.
- Updated activation lifecycle test coverage for the new prompt behavior.
