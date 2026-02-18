---
# beans-vscode-aroc
title: Verify OWASP MCP Hardness
status: completed
type: task
priority: high
created_at: 2026-02-18T20:26:50Z
updated_at: 2026-02-18T20:45:00Z
branch: feature/beans-vscode-aroc-verify-owasp-mcp-hardness
pr: https://github.com/selfagency/beans-vscode/pull/43
---

Review the OWASP MCP Top 10 project and verify the Beans extension's MCP server implementation against identified vulnerabilities.

[OWASP MCP Top 10 Project](https://github.com/OWASP/www-project-mcp-top-10)

## Todo

- [x] Review OWASP MCP Top 10 project
- [x] Audit BeansMcpServer.ts for MCP05 (Command Injection)
- [x] Audit BeansMcpServer.ts for MCP07 (Insufficient Auth/Authz)
- [x] Implement hardening measures in BeansMcpServer.ts
- [x] Add security tests in src/test/beans/mcp/BeansMcpServer.security.test.ts

## Summary of Changes

- **MCP01: Token Exposure**: Confirmed existing `getSafeEnv` whitelist protection for environment variables.
- **MCP05: Command Injection**: Hardened `cliPath` validation and confirmed `execFile` usage to avoid shell interpretation.
- **MCP07/MCP08: Resource Limits & Input Validation**: Added `zod` length limits to all string fields in tool schemas (e.g., `MAX_TITLE_LENGTH`, `MAX_DESCRIPTION_LENGTH`).
- **MCP10: Path Traversal**: Verified `resolveBeanFilePath` directory containment using `path.relative` check.
- **MCP03: Model Confused Deputy**: Confirmed that the chat assistant system prompt is already restricted to read-only Beans workflows.
- Expanded security tests in `src/test/beans/mcp/BeansMcpServer.security.test.ts`.

## Analysis Results

- The standalone MCP server implementation is highly resistant to command injection due to `execFile` usage.
- Inputs are now capped to prevent resource exhaustion (MCP08).
- Path traversal is already mitigated by explicit directory checking.
- Environment variables are scrubbed to prevent leaking host tokens (MCP01).
