---
# beans-vscode-d5e0
title: CI workflows
status: completed
type: task
priority: normal
created_at: 2026-02-16T04:05:02Z
updated_at: 2026-02-16T18:42:09Z
parent: beans-vscode-xwzf
---

Create GitHub Actions workflow for lint, typecheck, unit tests, and integration tests with xvfb. Add artifact upload on failures.

## Summary of Changes

✅ Created comprehensive CI/CD infrastructure:

### Workflows Created
- **CI workflow** (.github/workflows/ci.yml): Multi-OS testing (Ubuntu, macOS, Windows) with xvfb, type checking, linting, and test artifact uploads
- **Release workflow** (.github/workflows/release.yml): Automated extension packaging and publishing to VS Code Marketplace and Open VSX
- **Dependabot config** (.github/dependabot.yml): Weekly automated dependency updates with grouped PRs

### Documentation
- Added CI badges to README
- Documented required secrets (VSCE_PAT, OVSX_PAT) with permissions and setup steps
- Explained workflow behavior and requirements

### Test Results
All 127 tests passing locally (100% success rate)

Ready for CI validation on GitHub.
