---
# beans-vscode-im6o
title: Fix flaky updated-sort test and retag v1.0.5
status: completed
type: bug
priority: high
created_at: 2026-02-17T15:37:56Z
updated_at: 2026-02-17T15:49:09Z
---

Investigate timeout in BeansTreeDataProvider updated sort test on CI, apply fix, run tests, then delete/re-push release tag v1.0.5.

## Summary of Changes

- Stabilized flaky CI timeout in  updated-sort test.
- Updated test to use deterministic UTC dates and explicit 15s timeout headroom for slower runners.
- Verified 
> beans-vscode@1.0.4 lint /Users/daniel/Developer/beans-vscode
> eslint src


> beans-vscode@1.0.4 pretest /Users/daniel/Developer/beans-vscode
> pnpm run compile-tests && pnpm run compile && pnpm run lint


> beans-vscode@1.0.4 compile-tests /Users/daniel/Developer/beans-vscode
> tsc -p . --outDir out


> beans-vscode@1.0.4 compile /Users/daniel/Developer/beans-vscode
> pnpm run check-types && pnpm run lint && node esbuild.js


> beans-vscode@1.0.4 check-types /Users/daniel/Developer/beans-vscode
> tsc --noEmit


> beans-vscode@1.0.4 lint /Users/daniel/Developer/beans-vscode
> eslint src

[watch] build started
[watch] build finished

> beans-vscode@1.0.4 lint /Users/daniel/Developer/beans-vscode
> eslint src


> beans-vscode@1.0.4 test /Users/daniel/Developer/beans-vscode
> vitest run


[1m[46m RUN [49m[22m [36mv4.0.18 [39m[90m/Users/daniel/Developer/beans-vscode[39m

 [32m✓[39m src/test/beans/preview/BeansPreviewProvider.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 23[2mms[22m[39m
 [32m✓[39m src/test/beans/details/BeansDetailsViewProvider.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 26[2mms[22m[39m
 [32m✓[39m src/test/integration/ai/chat-integration.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 29[2mms[22m[39m
 [32m✓[39m src/test/beans/mcp/BeansMcpServer.tools.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 131[2mms[22m[39m
 [32m✓[39m src/test/integration/tree-population.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32m✓[39m src/test/beans/tree/BeansTreeDataProvider.test.ts [2m([22m[2m39 tests[22m[2m)[22m[32m 64[2mms[22m[39m
 [32m✓[39m src/test/beans/barrel-indexes.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 239[2mms[22m[39m
 [32m✓[39m src/test/integration/extension-lifecycle.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 65[2mms[22m[39m
 [32m✓[39m src/test/beans/tree/BeanTreeItem.test.ts [2m([22m[2m24 tests[22m[2m)[22m[32m 22[2mms[22m[39m
 [32m✓[39m src/test/beans/commands/BeansCommands.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m src/test/integration/ai/mcp-integration.test.ts [2m([22m[2m17 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32m✓[39m src/test/beans/tree/sorting.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 18[2mms[22m[39m
 [32m✓[39m src/test/beans/tree/BeansDragAndDropController.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m src/test/integration/extension-activation.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m src/test/beans/model/errors.test.ts [2m([22m[2m36 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m src/test/integration/command-registration.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32m✓[39m src/test/beans/logging/BeansOutput.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m src/test/beans/config/CopilotSkill.test.ts [2m([22m[2m17 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m src/test/integration/bean-operations.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m src/test/beans/mcp/BeansMcpServer.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32m✓[39m src/test/beans/search/BeansSearchViewProvider.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m src/test/beans/config/BeansConfigManager.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m src/test/integration/ai/prompt-assembly.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m src/test/beans/tree/BeansFilterManager.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m src/test/mocks/vscode.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/test/beans/commands/resolveBean.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32m✓[39m src/test/beans/config/CopilotInstructions.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/test/extension.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/test/beans/chat/prompts.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/test/beans/service/BeansService.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 753[2mms[22m[39m
       [33m[2m✓[22m[39m throws BeansTimeoutError on timeout [33m 706[2mms[22m[39m

[2m Test Files [22m [1m[32m30 passed[39m[22m[90m (30)[39m
[2m      Tests [22m [1m[32m410 passed[39m[22m[90m (410)[39m
[2m   Start at [22m 10:49:08
[2m   Duration [22m 1.13s[2m (transform 1.83s, setup 0ms, import 2.62s, tests 1.57s, environment 3ms)[22m passes locally (410/410 tests).
- Prepared release notes update and retag workflow for v1.0.5.
