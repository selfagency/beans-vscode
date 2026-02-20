---
title: Contributing to beans-vscode
---

Welcome! We're excited that you want to contribute to `beans-vscode`. This document provides guidance on how to contribute effectively and our core engineering practices.

## Core Developer Principles

We follow these principles to ensure high code quality, security, and maintainability:

1. **TDD-First**: We never write production code before writing a failing test.
2. **Security by Default**: We always prioritize security; no hardcoded secrets, no shell string interpolation.
3. **Accessibility Always**: All UI changes must follow WCAG 2.2 Level AA guidelines.
4. **Clean Code**: We use descriptive naming, avoid `any` types, and keep modules focused.
5. **Conventional Commits**: We use a structured commit message format to automate changelogs.

## The TDD Workflow (Red-Green-Refactor)

All new features and bug fixes must start with a failing test. No exceptions.

1. **🔴 Red**: Write a failing test in `src/test/` that describes the desired behavior.
   - Run `pnpm test` to confirm it fails specifically due to the missing implementation.
2. **🟢 Green**: Write the _minimal_ amount of production code in `src/` to make the test pass.
   - Run `pnpm test` to confirm it passes.
3. **🔄 Refactor**: Improve the code (structure, naming, performance) while keeping the tests green.

**Example**:
If adding a new validation to `BeansService`, first add a test case to `src/test/beans/service/BeansService.test.ts` that asserts the validation error, confirm failure, then implement the logic.

## Working with Beans (Issue Tracking)

We use Beans (this extension!) to track all work in this repository.

1. **Find or Create a Bean**: Before starting work, find an existing bean or create a new one.
   - Set status to `in-progress` when you begin.
2. **Track with Todo**: Add a `## Todo` checklist to the bean body and check items off as you go.
3. **Sync often**: Commit your bean updates frequently to track progress.
4. **Closing a Bean**:
   - For completion: Add a `## Summary of Changes` and set status to `completed`.
   - For scrapping: Add a `## Reasons for Scrapping` and set status to `scrapped`.

**Note**: In this repository, beans are located in the `.beans/` directory.

## Branch Naming & Commits

### Branch Naming

- **Features**: `feature/<bean-id>-<slug>` or `feat/<ticket>-<slug>`
- **Fixes**: `fix/<bean-id>-<slug>` or `fix/<ticket>-<slug>`
- **Docs/Chore**: `docs/<slug>` or `chore/<slug>`

_Example_: `feature/beans-vscode-li45-developer-docs`

## Local Development Setup

### Prerequisites: Pnpm

This project uses `pnpm` as the package manager. Install it via `npm install -g pnpm`.

### Installation

```bash
pnpm install
```

### Build and Watch

We use `esbuild` for bundling and `tsc` for type-checking.

```bash
pnpm run compile       # Single-shot build
pnpm run watch         # Watch for both esbuild and tsc
pnpm run watch:esbuild # Watch only (fast reload)
pnpm run watch:tsc     # Type-check only
```

### Testing

We use **Vitest** for unit tests and mocked integration suites, and `vscode-test` for extension-host integration tests.

```bash
pnpm test                 # Run all Vitest suites (unit + mocked integration in src/test/**/*.test.ts)
pnpm run test:watch       # Watch mode for Vitest tests
pnpm run test:integration # Run real extension-host integration tests via vscode-test (VS Code Test Electron/CLI)
```

**Markdown Templates in Tests**:
Our tests can import `.md` files as strings (used for Copilot templates). This is achieved via a custom `mdTextPlugin` in `vitest.config.ts`, which mirrors the `esbuild.js` loader configuration.

## Debugging the Extension

1. Open the project in VS Code.
2. Go to the **Run and Debug** view (`Ctrl+Shift+D`).
3. Select **Extension Development Host**.
4. Press `F5`. This opens a new VS Code window with your developmental version of the extension loaded.

## Running the MCP Server Locally

The Beans MCP server can be run as a standalone process for debugging:

```bash
# First, ensure the project is compiled
pnpm run compile

# Run the server manually
node ./dist/beans-mcp-server.js --workspace . --cli-path beans --port 39173
```

## Pull Request Checklist

Before submitting your PR, ensure:

- [ ] You have a corresponding Bean tracked in `.beans/`
- [ ] You are on a branch following the naming convention
- [ ] `pnpm run compile` and `pnpm run lint` pass without errors
- [ ] All tests pass (`pnpm test`)
- [ ] New functionality has test coverage (TDD-first)
- [ ] Accessibility (WCAG 2.2 Level AA) has been considered for UI changes
- [ ] Documentation (`README.md`, `CONTRIBUTING.md`, `docs/*.md`) is updated if needed
- [ ] Commit messages follow Conventional Commits

If your PR introduces a breaking change, please include `BREAKING CHANGE:` in the commit footer.
