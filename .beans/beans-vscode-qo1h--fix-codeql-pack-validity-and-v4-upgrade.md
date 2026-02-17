---
# beans-vscode-qo1h
title: Fix CodeQL pack validity and v4 upgrade
status: completed
type: bug
priority: high
created_at: 2026-02-17T16:10:25Z
updated_at: 2026-02-17T16:18:36Z
---

Resolve CodeQL init failures for local custom packs and upgrade github/codeql-action from v3 to v4.

## Summary of Changes

- Fixed CodeQL workflow custom pack paths to the current repository layout under .
- Upgraded CodeQL Action steps from v3 to v4 (, , ) to address deprecation warnings.
- Added  manifests for both local custom packs to improve pack validation compatibility.

## Notes

Corrected summary details:
- Custom pack paths now point to codeql/codeql-custom-queries-actions and codeql/codeql-custom-queries-javascript.
- CodeQL workflow uses github/codeql-action v4 for init/autobuild/analyze.
- Added qlpack.yml files to both custom packs for compatibility.

## Follow-up

Re-opened to fix remaining CodeQL init errors reporting local packs as invalid in GitHub Actions.

## Follow-up Resolution

- Replaced  usage in CodeQL workflow with direct local custom query paths in .
- Kept CodeQL Action on v4.
- This avoids pack validation failures for local packs in GitHub Actions while still running repository custom queries.
