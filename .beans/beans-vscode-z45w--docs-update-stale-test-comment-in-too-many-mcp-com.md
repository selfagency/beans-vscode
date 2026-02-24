---
# beans-vscode-z45w
title: 'docs: update stale test comment in too-many-mcp-commands.test.ts to reflect current regression-guard purpose'
status: todo
type: task
priority: low
created_at: 2026-02-24T13:49:34Z
updated_at: 2026-02-24T13:49:34Z
---

## Problem

The comment at the top of `src/test/beans/mcp/too-many-mcp-commands.test.ts` reads something like "this test is expected to FAIL prior to refactor", but the test currently passes (the tool count is within the `allowedMax = 10` limit).

The comment is now misleading: it describes the test as a pre-refactor diagnostic, but it has become a green regression guard. Developers reading it may wonder why it exists or whether it should be passing.

## Affected File

- `src/test/beans/mcp/too-many-mcp-commands.test.ts:4`

## Recommendation

Update the comment to describe the test's current purpose as a regression guard that enforces the maximum MCP tool count, rather than referencing the in-progress refactor.
