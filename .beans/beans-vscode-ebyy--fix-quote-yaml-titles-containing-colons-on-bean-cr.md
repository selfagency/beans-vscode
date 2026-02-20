---
# beans-vscode-ebyy
title: 'Fix: quote YAML titles containing colons on bean creation'
status: in-progress
type: task
branch: fix/ebyy-quote-yaml-titles-containing-colons
created_at: 2026-02-20T14:37:45Z
updated_at: 2026-02-20T14:37:45Z
---

## Problem

When a bean is created with a title containing a colon (e.g. "Command palette: Reinitialize Copilot instructions"), the beans CLI writes the title to YAML frontmatter without quoting it. This causes a YAML parse error (`yaml: line 2: mapping values are not allowed in this context`) on every subsequent `beans graphql` call, breaking all tree views.

The quarantine mechanism detects the file but the underlying problem is that the file was written with invalid YAML in the first place.

## Fix

After the CLI writes the bean file (in `createBeanWithConfig` and `batchCreateBeans`), read the file at the path returned in the response and repair any frontmatter fields whose values contain characters that require YAML quoting (`:`, `#`, `[`, `]`, `{`, `}`, `&`, `*`, `!`, `|`, `>`, `'`, `"`, `%`, `@`, `` ` ``).

## Todo

- [x] Add `repairBeanFrontmatter` helper that reads the file and re-writes any unquoted title containing special chars
- [x] Call it from `createBeanWithConfig` after normalizeBean
- [x] Call it from `batchCreateBeans` after normalizeBean for each result
- [x] Write failing tests
- [x] Verify compile passes
