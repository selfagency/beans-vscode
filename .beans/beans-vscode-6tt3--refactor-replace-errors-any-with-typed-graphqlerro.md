---
# beans-vscode-6tt3
title: 'refactor: replace errors?: any[] with typed GraphQLError interface in service and MCP layers'
status: completed
type: task
priority: normal
created_at: 2026-02-24T13:49:45Z
updated_at: 2026-02-24T15:56:18Z
---

## Problem

The GraphQL result type in `BeansService` uses `any[]` for the errors array:

```typescript
// src/beans/service/BeansService.ts:357
): Promise<{ data: T; errors?: any[] }>
```

The same pattern appears in `src/beans/mcp/BeansMcpServer.ts:112`. This means error objects are accessed without type safety at call sites (e.g. `e.message` is untyped).

## Affected Files

- `src/beans/service/BeansService.ts:357`
- `src/beans/mcp/BeansMcpServer.ts:112`

## Recommendation

Define and use a `GraphQLError` interface:

```typescript
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

// Then:
): Promise<{ data: T; errors?: GraphQLError[] }>
```

This provides type-safe access to `error.message` at all call sites and removes the final `any` from the service layer.
