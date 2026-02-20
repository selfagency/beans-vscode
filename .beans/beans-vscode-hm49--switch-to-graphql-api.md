---
# beans-vscode-hm49
title: switch to graphql api
status: completed
type: task
priority: normal
created_at: 2026-02-18T23:45:30Z
updated_at: 2026-02-18T23:45:51Z
id: beans-vscode-hm49
---
use beans graphql api instead of cli to ensure better safey

## Summary of Changes

- Migrated `BeansService` to use `beans graphql` transport with unified fragments.
- Refactored `BeansMcpServer` to use GraphQL and correctly formatted Bleve-compatible search filters.
- Standardized all 420 tests to handle the new GraphQL response shapes.
- Updated developer docs and AI templates to use `beans graphql --schema` instead of `beans prime`.
- Replaced all legacy `beans --json` invocations with `beans graphql` across the codebase.
- Verified consistency between `Bean.ts` model and `schema.gql`.
- Fixed mock test regressions in `BeansService.test.ts` and `BeansMcpServer.tools.test.ts`.
