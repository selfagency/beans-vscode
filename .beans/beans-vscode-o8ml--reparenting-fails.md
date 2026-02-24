---
# beans-vscode-o8ml
title: reparenting fails
status: in-progress
type: bug
priority: normal
created_at: 2026-02-23T17:34:44Z
updated_at: 2026-02-24T01:29:04Z
branch: fix/o8ml-reparenting-fails
pr: https://github.com/selfagency/beans-vscode/pull/73
---

 Failed to re-parent bean: Command failed: beans graphql --json fragment BeanFields on Bean { id slug path title body status type priority tags createdAt updatedAt etag parentId blockingIds blockedByIds } mutation UpdateBean($id: ID!, $input: UpdateBeanInput!) { updateBean(id: $id, input: $input) { ...BeanFields } } --variables {"id":"hurl-vscode-xf7y","input":{"parent":"hurl-vscode-i1zz"}} Error: graphql: feature beans can only have milestone or epic as parent, not feature Usage: beans graphql <query> [flags] Aliases: graphql, query Flags: -h, --help help for graphql --json Output JSON without colors (for piping) -o, --operation string Operation name (for multi-operation documents) --schema Print the GraphQL schema and exit -v, --variables string Query variables as JSON string Global Flags: --beans-path string Path to data ...
