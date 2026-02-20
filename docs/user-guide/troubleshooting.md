---
title: Troubleshooting
---

## Common troubleshooting steps

### Extension not activating

**Check**:

- Ensure workspace open
- Initialize Beans in project
- Check Beans output channel

### Tree views empty

**Check**:

- Run `Beans: Refresh`,
- Check filters
- Create a test bean

### Commands missing

**Check**:

- Initialize workspace or inspect context keys

### Performance

**Check**:

- Apply filters
- Check remote file system speed

## Copilot troubleshooting

### MCP Tools Not Available

**Check**:

- Is `beans.ai.enabled` set to `true`?
- Is the MCP server running?
- Are you using an MCP-compatible AI client?

**Solutions**:

1. Enable AI features: Settings → `beans.ai.enabled` → `true`
2. Refresh MCP server: `Beans: MCP: Refresh Server Definitions`
3. View server info: `Beans: MCP: Show Server Info`
4. Check logs: `Beans: MCP: Open Logs`

### Chat Participant Not Responding

**Check**:

- Is GitHub Copilot activated?
- Is `beans.ai.enabled` set to `true`?
- Is `@beans` recognized in Chat?

**Solutions**:

1. Check Copilot status in status bar
2. Enable AI features in extension settings
3. Reload window: `Developer: Reload Window`
4. Try a simple command: `@beans /summary`

### Copilot Skill Not Being Used

**Check**:

- Is `.github/skills/beans/SKILL.md` present?
- Is file content up to date?

**Solutions**:

1. Verify skill file exists in workspace
2. Refresh skill: `Beans: Generate Copilot Skill`
3. Copilot may need time to index the file
4. Try explicitly mentioning Beans in your prompt

### MCP Server Crashes

**Check**:

- View error messages in Output channel
- Check logs: `Beans: MCP: Open Logs`

**Solutions**:

1. Check workspace is initialized: `beans init`
2. Verify Beans CLI is working: `beans --version`
3. Reload window: `Developer: Reload Window`
4. Check for extension updates
5. Report issue with logs
