---
# beans-vscode-af9s
title: 'fix: quarantine notifcation failure'
status: completed
type: bug
priority: normal
created_at: 2026-02-24T14:29:57Z
updated_at: 2026-02-24T14:36:38Z
---

instead of notifying about the file being quarantined and needing to be fixed, 132 x 18 1 Failed to fetch beans: Command failed: beans graphql --json fragment BeanFields on Bean { id slug path title body status type priority tags createdAt updatedAt etag parentId blockingIds blockedByIds } query ListBeans($filter: BeanFilter) { beans(filter: $filter) { ...BeanFields } } --variables {"filter":{"status":["todo","in-progress"]}} Error: loading beans: loading /Users/daniel/Developer/beans-vscode/.beans/.quarantine/beans-vscode-gamf--fix-beanstreedataprovider-eventemitter-never-dispo.md: parsing front matter: yaml: line 10: found character that cannot start any token Usage: beans graphql <query> [flags] Aliases: graphql, query Flags: -h, --help help for graphql --json Output JSON without colors (for piping) -o, --operation string Operation name (for multi-operation documents) --schema Print the GraphQL schema and exit -v, --var... appeared three times
