---
# beans-vscode-qo1h
title: Fix CodeQL pack validity and v4 upgrade
status: completed
type: bug
priority: high
created_at: 2026-02-17T16:10:25Z
updated_at: 2026-02-17T16:15:30Z
---

Resolve CodeQL init failures for local custom packs and upgrade github/codeql-action from v3 to v4.

## Summary of Changes

- Fixed CodeQL workflow custom pack paths to the current repository layout under .
- Upgraded CodeQL Action steps from v3 to v4 (, , ) to address deprecation warnings.
- Added  manifests for both local custom packs to improve pack validation compatibility.
