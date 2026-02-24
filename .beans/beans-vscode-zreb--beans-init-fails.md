---
# beans-vscode-zreb
title: Beans init fails
status: in-progress
type: bug
priority: critical
branch: fix/zreb-beans-init-fails
created_at: 2026-02-22T06:53:23Z
updated_at: 2026-02-24T01:23:01Z
---

Failed to initialize Beans: Failed to parse beans CLI JSON output

## Root Cause

`BeansService.init()` calls `this.execute<...>(args)` without passing `--json`.
`execute()` always calls `JSON.parse(stdout)`, but `beans init` outputs plain text
without `--json`. Fix: add `'--json'` to the args array in `init()`.

## Todo

- [x] Set bean in-progress, create branch `fix/zreb-beans-init-fails`
- [x] Write failing test
- [x] Add `--json` flag to `BeansService.init()`
- [x] Verify test passes (82/82 green, compile clean)
- [ ] Commit and push
