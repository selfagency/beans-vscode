---
# beans-vscode-hm49
title: switch to graphql api
status: completed
type: epic
priority: normal
created_at: 2026-02-18T19:50:03Z
updated_at: 2026-02-18T22:01:19Z
branch: feature/graphql
pr: 45
---

use beans graphql api instead of cli to ensure better safey

## Summary of Changes

- Migrated `BeansService` to use `beans graphql` transport with unified fragments.
- Refactored `BeansMcpServer` to use GraphQL and correctly formatted Bleve-compatible search filters.
- Standardized all 55 tests to handle the new GraphQL response shapes.
- Cleaned up ESLint `curly` warnings across the test suite.
