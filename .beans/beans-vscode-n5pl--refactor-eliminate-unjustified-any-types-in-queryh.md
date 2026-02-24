---
# beans-vscode-n5pl
title: 'refactor: eliminate unjustified any types in queryHelpers, DetailsViewProvider, and extension.ts'
status: completed
type: task
priority: high
created_at: 2026-02-24T13:49:01Z
updated_at: 2026-02-24T16:02:31Z
---

## Problem

Several production files use `any` types without justification, violating the project's no-`any` policy.

### `src/beans/mcp/internal/queryHelpers.ts`

The entire file is typed with `any`:

- Line 3: `function sortBeansInternal(beans: any[], mode: SortMode): any[]`
- Line 64: `backend: any`
- Lines 112, 125, 133, 143: multiple `any` annotations in callbacks

`BeansMcpServer.ts` already defines a `BeanRecord` type. The `backend` parameter should use a typed interface.

### `src/beans/details/BeansDetailsViewProvider.ts:100`

```typescript
private async handleBeanUpdate(updates: any): Promise<void> {
```

The `DetailsWebviewMessage` type already types `updates` as `unknown` at line 6. The handler should accept `unknown` and narrow it properly.

### `src/extension.ts:339`

```typescript
const tryReapply = (provider: any | undefined) => {
```

The three providers share a duck-typed `reapplyHeaderTitles()` method. Extract an interface and type this properly.

### `src/beans/mcp/BeansMcpServer.ts:453-468`

Multiple `(backend as any).show` / `(backend as any).executeGraphQL` casts to probe for methods. Extract `BeansCliBackend`'s public surface into a TypeScript interface used by both `registerTools` and test doubles.

### `src/beans/service/BeansService.ts:357`

```typescript
): Promise<{ data: T; errors?: any[] }>
```

GraphQL errors should use a typed interface (see separate bean for `errors?: any[]`).
