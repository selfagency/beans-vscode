---
# beans-vscode-3jam
title: 'Fix review blockers: parent clear + details link sanitization'
status: completed
type: bug
priority: critical
created_at: 2026-02-17T05:42:33Z
updated_at: 2026-02-17T05:47:54Z
---

Implement blocking review fixes: (1) parent removal semantics in command and drag-to-root flows, (2) sanitize markdown link hrefs in details webview and add strict CSP, plus focused tests and verification runs.

## Summary of Changes

Implemented review blockers and important follow-ups: explicit clear-parent semantics in service/commands/drag-drop, details/search CSP hardening, markdown href scheme allowlisting, mirrored-log write queue, active tree map optimization, streamed MCP output log tailing; verified with pnpm run compile and pnpm test (30 files, 402 tests).
