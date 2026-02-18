---
# beans-vscode-2t0w
title: Improve instructions and skills generation
status: completed
type: feature
branch: feature/improve-instructions-skills-generation
created_at: 2026-02-18T13:24:39Z
updated_at: 2026-02-18T19:00:00Z
---

Improve the quality and coverage of auto-generated Copilot instructions (.github/copilot-instructions.md) and skills (.github/skills/). This includes better prompts, more accurate capability descriptions, smarter context gathering from the workspace, and ensuring generated content stays in sync with the extension's actual command surface and architecture.

## Summary of Changes

- Extracted template strings from `CopilotInstructions.ts` and `CopilotSkill.ts` into dedicated `.md` files under `src/beans/config/templates/`; added esbuild `loader: { '.md': 'text' }` and `src/types/md.d.ts` ambient declaration.
- Rewrote `.github/copilot-instructions.md` from a 236-line aspirational spec to a 69-line accurate implementation reference (build commands, module map, 5 key patterns, testing, security, definition of done).
- Strengthened `copilot-instructions.template.md` with a 7-rule `<CRITICALLY_IMPORTANT>` block: mandatory bean, extension/MCP-first interface priority, `## Todo` checklist, prompt bean commits, create branch before code, record branch/PR in frontmatter, closing conventions. Added full command lists, MCP workflow, epic planning mode with compact checklist format, and CLI constraints (`--json` always, `--body-file` for large text).
- Rewrote `copilot-skill.template.md` with keyword-rich description, core rules, step-by-step start/during/complete/scrap workflows, full `beans.*` command reference table, `@beans` slash command table with "when to use / what it returns" columns, MCP tool guidance, and 7-step planning mode.
- Aligned `BeansChatIntegration.ts` with the templates: fixed valid bean types (removed `epic`), added `beans.copilotStartWork` hint in `/next`, improved `/commit` output with conventional commit format and post-commit bean update reminder, expanded candidate list from 5 → 8.
- Updated `prompts.ts` system prompt to declare `@beans` as read-only and list exact extension command names for all mutation operations.
