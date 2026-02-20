---
title: Testing
---

This document covers the testing strategy, test execution, writing tests, and CI/CD integration for the Beans VS Code extension.

[![Tests](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/tests.yml)
[![codecov](https://codecov.io/github/selfagency/beans-vscode/graph/badge.svg?token=2TKB7KQ6II)](https://codecov.io/github/selfagency/beans-vscode)

## Overview

The extension uses a comprehensive testing strategy with:

- **Unit Tests**: Vitest for fast, isolated tests
- **Integration Tests**: VS Code Test Electron for extension host integration
- **Mocked VS Code API**: Custom mocks for rapid testing without full VS Code
- **CI/CD Integration**: Automated testing on Ubuntu, macOS, and Windows

## Testing Stack

### Core Tools

- **[Vitest](https://vitest.dev/)**: Fast unit test framework with TypeScript support
- **[@vscode/test-electron](https://github.com/microsoft/vscode-test)**: VS Code extension testing framework
- **[@vscode/test-cli](https://github.com/microsoft/vscode-test)**: CLI runner for VS Code extension tests
- **TypeScript ESLint**: Static analysis for test code quality

### Test Structure

```text
src/test/
├── extension.test.ts             # Basic extension tests
├── mocks/                        # VS Code API mocks
│   └── vscode.ts                 # Mock VS Code module
├── beans/                        # Unit tests by module
│   ├── chat/
│   │   └── prompts.test.ts       # Chat prompt formatting tests
│   ├── commands/
│   │   └── resolveBean.test.ts   # Command argument resolution tests
│   ├── config/
│   │   ├── CopilotInstructions.test.ts
│   │   └── CopilotSkill.test.ts
│   ├── mcp/
│   │   └── BeansMcpServer.test.ts
│   └── tree/
│       ├── BeanTreeItem.test.ts
│       └── sorting.test.ts       # Bean sorting algorithm tests
└── integration/                  # Integration tests
    ├── bean-operations.test.ts   # CRUD operations
    ├── command-registration.test.ts
    ├── extension-activation.test.ts
    ├── tree-population.test.ts
    └── ai/                       # AI integration tests
        ├── chat-integration.test.ts
        ├── mcp-integration.test.ts
        └── prompt-assembly.test.ts
```

## Running Tests

### Quick Reference

```bash
# Run all unit tests (Vitest)
pnpm test

# Watch mode for development
pnpm test:watch

# Run integration tests (VS Code Test Electron)
pnpm test:integration

# Compile, lint, and test (full validation)
pnpm run pretest && pnpm test
```

### Importing Markdown Templates in Tests

Certain tests (e.g., `CopilotInstructions.test.ts` and `CopilotSkill.test.ts`) require importing markdown template files from `src/beans/config/templates/*.md`.

Since Vitest uses Vite's transform pipeline, and Vite does not have a built-in `.md` loader, we use a custom `mdTextPlugin` in `vitest.config.ts`. This mirrors the `esbuild.js` loader: `{ '.md': 'text' }`.

**Usage in tests** (matching the real template locations):

```ts
// From src/test/beans/config/CopilotInstructions.test.ts
import copilotInstructionsTemplate from '../../../beans/config/templates/copilot-instructions.template.md';

// From src/test/beans/config/CopilotSkill.test.ts
import copilotSkillTemplate from '../../../beans/config/templates/copilot-skill.template.md';

// Each imported value is a string containing the markdown content.
```

### Writing Tests (TDD-First)

**Command**: `pnpm test`

Runs fast, isolated tests without launching VS Code:

- Executes `vitest run`
- Tests in `src/test/**/*.test.ts`
- Uses Node.js environment
- Mocks VS Code API via alias
- Typical run time: < 5 seconds

**Features**:

- Fast feedback loop
- No GUI required
- Runs in any environment (local, CI, Docker)
- Supports watch mode for TDD

**Example Output**:

```text
 ✓ src/test/beans/chat/prompts.test.ts (5 tests) 23ms
 ✓ src/test/beans/tree/sorting.test.ts (8 tests) 15ms
 ✓ src/test/beans/config/CopilotSkill.test.ts (4 tests) 12ms

 Test Files  43 passed (43)
      Tests  127 passed (127)
   Duration  1.82s
```

### Integration Tests (VS Code Test Electron)

**Command**: `pnpm test:integration`

Runs tests in actual VS Code extension host:

- Executes `vscode-test`
- Launches headless VS Code
- Loads extension in test environment
- Tests real VS Code API interactions
- Typical run time: 15-30 seconds

**When to use**:

- Testing extension activation
- Verifying command registration
- Testing webview providers
- Validating tree view behavior
- MCP/chat integration tests

**Example Output**:

```text
✔ Extension activated successfully
✔ Commands registered
✔ Tree providers populated
✔ MCP server started

Integration Tests: 24 passed
```

### Watch Mode (TDD Workflow)

**Command**: `pnpm test:watch`

Automatically re-runs tests on file changes:

```bash
pnpm test:watch
```

**Features**:

- Instant feedback on code changes
- File filtering: Press `p` to filter by filename
- Test filtering: Press `t` to filter by test name
- Only re-runs affected tests
- Type-aware: Detects type errors

**Workflow**:

1. Start watch mode: `pnpm test:watch`
2. Edit tests or source code
3. Tests auto-run on save
4. Fix failures, repeat

### Pre-Test Validation

**Command**: `pnpm run pretest`

Runs before test suite to ensure code quality:

```bash
pnpm run pretest
# Equivalent to:
# pnpm run compile-tests && pnpm run compile && pnpm run lint
```

**Steps**:

1. Compile tests: TypeScript → JavaScript
2. Compile extension: Bundle with esbuild
3. Lint: ESLint static analysis

## Writing Tests

### Unit Test Template

Create test files with `.test.ts` extension in `src/test/`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('YourModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });

  it('should do something specific', () => {
    // Arrange: Set up test data
    const input = 'test';

    // Act: Execute function under test
    const result = yourFunction(input);

    // Assert: Verify expected outcome
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(() => yourFunction(null)).toThrow();
  });
});
```

### Mocking VS Code API

Use the custom VS Code mock in unit tests:

```typescript
import * as vscode from 'vscode'; // Resolves to src/test/mocks/vscode.ts
import { vi } from 'vitest';

// Mock specific VS Code functions
vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
  get: vi.fn((key: string) => {
    if (key === 'cliPath') return 'beans';
    return undefined;
  }),
  has: vi.fn(),
  inspect: vi.fn(),
  update: vi.fn(),
} as any);
```

### Testing Async Code

Use `async`/`await` for promises:

```typescript
it('should fetch bean from service', async () => {
  const service = new BeansService('/workspace');
  const bean = await service.getBean('beans-vscode-abc');

  expect(bean.id).toBe('beans-vscode-abc');
  expect(bean.status).toBe('todo');
});
```

### Testing Error Handling

Verify errors are thrown correctly:

```typescript
it('should throw when bean not found', async () => {
  const service = new BeansService('/workspace');

  await expect(service.getBean('invalid')).rejects.toThrow('Bean not found');
});
```

### Testing Command Implementations

Test commands by mocking dependencies:

```typescript
import { BeansCommands } from '../../beans/commands/BeansCommands';
import { BeansService } from '../../beans/service/BeansService';
import { vi } from 'vitest';

describe('BeansCommands', () => {
  let commands: BeansCommands;
  let mockService: BeansService;

  beforeEach(() => {
    mockService = {
      getBean: vi.fn(),
      updateBean: vi.fn(),
      listBeans: vi.fn(),
    } as any;

    commands = new BeansCommands(mockService, mockContext, mockPreviewProvider, mockFilterManager, mockConfigManager);
  });

  it('should view bean', async () => {
    mockService.getBean.mockResolvedValue({
      id: 'beans-vscode-abc',
      title: 'Test Bean',
      status: 'todo',
    });

    await commands.viewBean({ id: 'beans-vscode-abc' });

    expect(mockService.getBean).toHaveBeenCalledWith('beans-vscode-abc');
  });
});
```

### Testing Tree Providers

Test tree data providers with mock beans:

```typescript
import { BeansTreeDataProvider } from '../../beans/tree/BeansTreeDataProvider';
import { Bean } from '../../beans/model';

describe('BeansTreeDataProvider', () => {
  let provider: BeansTreeDataProvider;
  let mockService: BeansService;

  const mockBeans: Bean[] = [
    { id: 'bean-1', title: 'Bean 1', status: 'todo', type: 'task' },
    { id: 'bean-2', title: 'Bean 2', status: 'in-progress', type: 'feature' },
  ];

  beforeEach(() => {
    mockService = {
      listBeans: vi.fn().mockResolvedValue(mockBeans),
    } as any;

    provider = new BeansTreeDataProvider(mockService, ['todo', 'in-progress']);
  });

  it('should load beans', async () => {
    await provider.refresh();
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('bean-1');
  });

  it('should filter by status', async () => {
    provider = new BeansTreeDataProvider(mockService, ['todo']);
    await provider.refresh();
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0].bean.status).toBe('todo');
  });
});
```

### Testing Chat Integration

Test chat participant prompts and responses:

```typescript
import { describe, expect, it } from 'vitest';
import { formatSummaryPrompt } from '../../beans/chat/prompts';

describe('Chat Prompts', () => {
  it('should format summary prompt with bean counts', () => {
    const beans = [
      { id: '1', status: 'todo', priority: 'high' },
      { id: '2', status: 'in-progress', priority: 'critical' },
    ];

    const prompt = formatSummaryPrompt(beans);

    expect(prompt).toContain('2 active beans');
    expect(prompt).toContain('1 critical');
    expect(prompt).toContain('1 high');
  });
});
```

### Integration Test Template

Create integration tests in `src/test/integration/`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate } from '../../extension';

describe('Integration Test Suite', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Setup full mock context
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  it('should activate extension', async () => {
    await activate(mockContext);

    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should register commands', async () => {
    const spy = vi.spyOn(vscode.commands, 'registerCommand');

    await activate(mockContext);

    expect(spy).toHaveBeenCalledWith('beans.view', expect.any(Function));
    expect(spy).toHaveBeenCalledWith('beans.create', expect.any(Function));
  });
});
```

## Testing Best Practices

### 1. Test Behavior, Not Implementation

**Good**:

```typescript
it('should update bean status', async () => {
  const bean = await service.updateBean('bean-1', { status: 'completed' });
  expect(bean.status).toBe('completed');
});
```

**Bad**:

```typescript
it('should call execute with correct args', () => {
  const spy = vi.spyOn(service, 'execute');
  service.updateBean('bean-1', { status: 'completed' });
  expect(spy).toHaveBeenCalledWith(['beans', 'update', ...]);
});
```

### 2. Use Descriptive Test Names

**Good**:

```typescript
it('should filter beans by status when status filter applied', () => {});
it('should throw BeansCLINotFoundError when CLI not in PATH', () => {});
it('should return empty array when no beans match filter', () => {});
```

**Bad**:

```typescript
it('works', () => {});
it('test filter', () => {});
it('should do the thing', () => {});
```

### 3. Follow Arrange-Act-Assert Pattern

```typescript
it('should sort beans by priority', () => {
  // Arrange: Set up test data
  const beans = [
    { id: '1', priority: 'normal' },
    { id: '2', priority: 'critical' },
  ];

  // Act: Execute function under test
  const sorted = sortBeans(beans, 'priority');

  // Assert: Verify expected outcome
  expect(sorted[0].priority).toBe('critical');
  expect(sorted[1].priority).toBe('normal');
});
```

### 4. Test Edge Cases

```typescript
describe('Bean sorting', () => {
  it('should handle empty array', () => {
    expect(sortBeans([], 'priority')).toEqual([]);
  });

  it('should handle beans without priority', () => {
    const beans = [{ id: '1' }]; // No priority field
    const sorted = sortBeans(beans, 'priority');
    expect(sorted).toHaveLength(1);
  });

  it('should handle single bean', () => {
    const beans = [{ id: '1', priority: 'high' }];
    expect(sortBeans(beans, 'priority')).toEqual(beans);
  });
});
```

### 5. Clean Up After Tests

```typescript
afterEach(() => {
  // Clear all mocks to prevent test pollution
  vi.clearAllMocks();

  // Restore original implementations
  vi.restoreAllMocks();

  // Clean up timers
  vi.clearAllTimers();
});
```

### 6. Isolate Tests

Each test should be independent:

```typescript
// BAD: Tests depend on order
let sharedState = [];

it('test 1', () => {
  sharedState.push('item');
  expect(sharedState).toHaveLength(1);
});

it('test 2', () => {
  // Fails if test 1 doesn't run first
  expect(sharedState).toHaveLength(1);
});

// GOOD: Tests are independent
it('test 1', () => {
  const localState = [];
  localState.push('item');
  expect(localState).toHaveLength(1);
});

it('test 2', () => {
  const localState = ['item'];
  expect(localState).toHaveLength(1);
});
```

### 7. Use Test Fixtures

Create reusable test data:

```typescript
// test-fixtures.ts
export const mockBeans = {
  todo: (): Bean => ({
    id: 'bean-todo',
    title: 'Todo Bean',
    status: 'todo',
    type: 'task',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }),

  inProgress: (): Bean => ({
    id: 'bean-ip',
    title: 'In Progress Bean',
    status: 'in-progress',
    type: 'feature',
    priority: 'high',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  }),
};

// In tests
import { mockBeans } from './test-fixtures';

it('should handle todo beans', () => {
  const bean = mockBeans.todo();
  expect(bean.status).toBe('todo');
});
```

## Test Coverage

### Current Coverage

Run tests with coverage reporting:

```bash
pnpm test -- --coverage
```

### Coverage Goals

- **Unit Tests**: 80%+ line coverage
- **Integration Tests**: All major user workflows
- **Critical Paths**: 100% coverage for:
  - CLI command execution
  - Bean CRUD operations
  - Status/type/priority updates
  - Parent/blocking relationship management

### Viewing Coverage Report

```bash
# Generate HTML coverage report
pnpm test -- --coverage

# Open report in browser
open coverage/index.html
```

## CI/CD Integration

### GitHub Actions Workflows

#### CI Workflow (.github/workflows/ci.yml)

Runs on every push and pull request:

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm run compile
      - run: pnpm test
```

**Features**:

- Tests on Ubuntu, macOS, and Windows
- Uses xvfb on Linux for headless testing
- Uploads test artifacts on failure
- Reports test results in PR checks

#### Test Artifacts

On failure, CI uploads:

- Test output logs
- Coverage reports (if enabled)
- Extension build artifacts (`.vsix`)

Access via:

1. Go to failed workflow run
2. Scroll to "Artifacts" section
3. Download test logs

### Local CI Simulation

Replicate CI environment locally:

```bash
# Run full CI validation
pnpm run pretest && pnpm test && pnpm test:integration

# Test on multiple Node versions (if using nvm)
nvm use 22 && pnpm test
nvm use 20 && pnpm test
```

## Debugging Tests

### Debug in VS Code

1. Set breakpoints in test files
2. Open "Run and Debug" sidebar (`Cmd+Shift+D`)
3. Select "Extension Tests" configuration
4. Press `F5` to start debugging

### Debug Vitest Tests

```bash
# Run tests with --inspect flag
node --inspect-brk ./node_modules/vitest/vitest.mjs run

# Then attach VS Code debugger:
# 1. Set breakpoints
# 2. Run "Attach to Node Process"
# 3. Select vitest process
```

### Debug Integration Tests

```bash
# Run with verbose output
pnpm test:integration -- --verbose

# Run specific test file
pnpm test:integration -- --grep "Extension Activation"
```

### Common Test Failures

#### "Cannot find module 'vscode'"

**Cause**: Import path not aliased correctly.

**Solution**: Ensure `vitest.config.ts` includes:

```typescript
resolve: {
  alias: {
    vscode: path.resolve(__dirname, 'src/test/mocks/vscode.ts');
  }
}
```

#### "Timeout of 5000ms exceeded"

**Cause**: Async operation taking too long.

**Solution**: Increase timeout or mock slow operations:

```typescript
it('should handle slow operation', async () => {
  // Increase timeout for this test
  vi.setTimeout(10000);

  await slowOperation();
});
```

#### "Mock not called"

**Cause**: Mock setup incorrect or not triggered.

**Solution**: Verify mock is set up before function call:

```typescript
const mockFn = vi.fn();
service.someMethod = mockFn; // Set mock

service.someMethod(); // Trigger

expect(mockFn).toHaveBeenCalled(); // Assert
```

## Performance Testing

### Benchmarking

Measure performance of critical operations:

```typescript
import { describe, it, bench } from 'vitest';

describe('Performance', () => {
  bench('sort 1000 beans', () => {
    const beans = generateBeans(1000);
    sortBeans(beans, 'priority');
  });

  bench('filter 10000 beans', () => {
    const beans = generateBeans(10000);
    filterBeans(beans, { status: ['todo'] });
  });
});
```

Run with:

```bash
pnpm test -- --run bench
```

## Future Testing Enhancements

### Planned Improvements

- [x] **Remote compatibility testing** - Automated Docker and Dev Container tests
- [ ] E2E tests with Playwright for full user workflows
- [ ] Visual regression testing for webviews
- [ ] Performance benchmarks in CI
- [ ] Mutation testing for test quality
- [ ] Snapshot testing for tree view rendering

### Remote Development Testing

The extension includes automated remote compatibility testing:

**CI Workflow**: `.github/workflows/remote-test.yml`

- Tests in multiple Docker images (Alpine, Debian, DevContainers)
- Tests with different Node.js versions (20, 22)
- Validates Beans CLI installation in containers
- Tests all core bean operations in containerized environment
- Dev Container build and functionality testing

**Local Testing**: `scripts/test-remote.sh`

```bash
# Run remote compatibility tests locally
./scripts/test-remote.sh
```

This script:

- Builds a Docker test environment
- Installs beans CLI in the container
- Tests all core operations (create, update, query, relationships)
- Validates GraphQL queries and search
- Tests parent-child and blocking relationships
- Verifies file structure and data persistence

See [Remote Compatibility Testing Guide](./remote-testing.md) for manual testing procedures in SSH, WSL, Dev Containers, and Codespaces.

### Testing Remote Scenarios

Create test suite for remote development:

```typescript
describe('Remote Development', () => {
  it('should resolve CLI path on remote', async () => {
    // Mock remote filesystem
    // Test CLI resolution
  });

  it('should spawn MCP server with remote Node', async () => {
    // Mock process.execPath
    // Test MCP server startup
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Testing Best Practices](https://testingjavascript.com/)
- [TDD with Vitest](https://vitest.dev/guide/why.html)

## Contributing Tests

When contributing, ensure:

1. **Tests pass**: Run `pnpm test` and `pnpm test:integration`
2. **Coverage maintained**: Don't reduce overall coverage percentage
3. **Tests included**: New features require tests
4. **Bug fixes verified**: Add regression tests
5. **Integration tested**: Major changes need integration tests

See [Architecture Documentation](./architecture.md) for system design context.
