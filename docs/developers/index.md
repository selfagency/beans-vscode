---
title: Developers
---

We welcome contributions and follow a strict **TDD-first** (Test-Driven Development) workflow. For detailed onboarding, branch naming conventions, and the Beans workflow, please refer to the **[Contributing Guide](/developers/contributing)**.

## Quick Setup

```bash
git clone https://github.com/selfagency/beans-vscode.git
cd beans-vscode
pnpm install
pnpm run compile
pnpm test
```

## Common Commands

```bash
pnpm run watch         # Watch for code and type changes
pnpm run test:watch    # Watch mode for unit tests
pnpm run lint          # Lint changes
pnpm run check-types   # Type-check everything
```

## Running Locally

- **Debug Extension**: Press `F5` in VS Code to launch the **Extension Development Host**.
- **MCP Server**: Run `node ./dist/beans-mcp-server.js` (see [CONTRIBUTING.md](/developers/contributing#running-the-mcp-server-locally) for details).

## Testing

Please see our test documentation for full details on our testing procedures.

- [Testing](/developers/testing)
- [Remote compatibility testing](/developers/remote-testing)

## Contributing

Please see our **[Contributing Guide](/developers/contributing)** for full details on our developer principles, branch naming, and pull request process.

1. **Find or create a Bean** in `.beans/` (this project uses Beans for self-tracking!)
2. **Implement changes** using the TDD-first workflow.
3. **Ensure all checks pass** including linting and tests.
4. **Submit a PR** with conventional commits.
