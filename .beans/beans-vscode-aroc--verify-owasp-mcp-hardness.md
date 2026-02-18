---
# beans-vscode-aroc
title: Verify OWASP MCP Hardness
status: todo
type: task
priority: high
created_at: 2026-02-18T20:26:50Z
updated_at: 2026-02-18T20:26:50Z
---

Review the OWASP MCP Top 10 project and verify the Beans extension's MCP server implementation against identified vulnerabilities.

Link: https://github.com/OWASP/www-project-mcp-top-10

## Todo
- [ ] Review OWASP MCP Top 10 project
- [ ] Audit BeansMcpServer.ts for MCP05 (Command Injection)
- [ ] Audit BeansMcpServer.ts for MCP07 (Insufficient Auth/Authz)
- [ ] Implement hardening measures in BeansMcpServer.ts
- [ ] Add security tests in src/test/beans/mcp/BeansMcpServer.security.test.ts
