---
# beans-vscode-kqd8
title: Add Q&A section to VS Code marketplace listing
status: completed
type: feature
priority: "3"
created_at: 2026-02-19T19:35:47Z
updated_at: 2026-02-19T19:35:52Z
---

## Overview

Enable the Q&A section on the Beans extension's VS Code marketplace listing.

The VS Code marketplace supports a `qna` field in `package.json` that controls whether and where the Q&A tab appears on the extension's marketplace page. Options are:

- `"marketplace"` — uses the built-in VS Code marketplace Q&A feature
- A URL string — redirects Q&A to an external page (e.g. GitHub Discussions)
- `false` — disables Q&A entirely

## Goal

Add a `qna` field to `package.json` enabling the built-in marketplace Q&A so users can ask and answer questions directly on the extension's marketplace page.

## Todo

- [x] Decide between built-in marketplace Q&A vs. GitHub Discussions URL
- [x] Add `qna` field to `package.json`
- [x] Commit and push

## Summary of Changes

Added `"qna": "marketplace"` to `package.json`. The built-in VS Code marketplace Q&A tab will now be active on the extension's listing page.
