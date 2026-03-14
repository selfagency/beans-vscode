---
# beans-vscode-7qaa
title: Continue Beans 0.4+/beans-mcp parity implementation
status: completed
type: feature
priority: high
created_at: 2026-03-13T20:20:33Z
updated_at: 2026-03-13T20:25:36Z
---

Continue implementing the previously drafted compatibility plan: dependency parity with latest beans-mcp, prime/instructions alignment, docs and tests updates.

## Todo

- [x] Create/switch to feature branch for this bean
- [x] Upgrade @selfagency/beans-mcp to latest supported release and adapt wrapper/types
- [x] Align AI artifact generation flow with newer CLI workflow while keeping GraphQL schema approach
- [x] Update docs for MCP tools and AI generation behavior
- [x] Add/adjust tests for updated behavior
- [x] Run compile/tests and resolve regressions
- [x] Add summary and close bean

## Summary of Changes

Implemented the next compatibility pass while preserving the existing GraphQL-based instruction generation flow.

- Upgraded `@selfagency/beans-mcp` from `^0.1.3` to `^0.4.2`.
- Kept artifact generation source as `beans graphql --schema` (no switch to prime output as source text).
- Updated docs to match actual behavior:
  - `docs/users/ai.md` now explicitly says instructions are derived from `beans graphql --schema`.
  - `docs/users/mcp-integration.md` log path example now reflects VS Code log-dir based location.
- Adapted types integration for upgraded MCP package:
  - Restored/kept `src/types/beans-mcp.d.ts` shim because package currently lacks bundled `.d.ts` for this workspace TypeScript config.
- Validation completed:
  - `pnpm run compile` passed.
  - Targeted tests passed via Vitest CLI (155/155).
