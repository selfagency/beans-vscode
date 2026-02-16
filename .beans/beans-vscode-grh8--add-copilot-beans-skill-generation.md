---
# beans-vscode-grh8
title: Add Copilot Beans skill generation
status: completed
type: task
priority: normal
created_at: 2026-02-16T16:37:30Z
updated_at: 2026-02-16T16:45:10Z
---

Generate a Beans SKILL.md artifact for Copilot and only enable/manage it when beans.ai.enabled is true.

## Summary of Changes

- Added compact Copilot skill generator at src/beans/config/CopilotSkill.ts.
- Generates .github/skills/beans/SKILL.md when beans.ai.enabled is true.
- Removes generated skill file when beans.ai.enabled is false.
- Wired artifact sync into activation/init flows via ensureCopilotAiArtifacts().
- Added unit test for skill content generation and updated README documentation.
- Verified compile and tests pass (45 tests).
