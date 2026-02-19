---
# beans-vscode-98pg
title: Fix quarantine rename — malformed bean file not being moved to .fixme
status: ""
type: bug
priority: "2"
created_at: 2026-02-19T19:56:39Z
updated_at: 2026-02-19T19:56:39Z
---

## Problem

When a bean file is malformed, `quarantineMalformedBeanFile()` is supposed to rename it from `.md` → `.fixme` so it is visibly quarantined and excluded from future CLI queries. However the rename is not happening — the file stays at its original `.md` path.

## Todo

- [ ] Audit `quarantineMalformedBeanFile` and the call path through `tryRepairMalformedBean` → `normalizeBean` to find why the rename silently fails
- [ ] Add logging inside the `catch` block of `quarantineMalformedBeanFile` so failures surface instead of being silently swallowed
- [ ] Add/update tests for the quarantine path
- [ ] Verify the fix end-to-end with a real malformed bean file
