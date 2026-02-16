# Remote Compatibility Testing Guide

This document provides step-by-step instructions for testing the Beans VS Code extension in various remote development scenarios.

## Prerequisites

- VS Code with Remote Development extensions installed
- Access to test environments (SSH server, Docker, GitHub account for Codespaces)
- Beans VS Code extension `.vsix` file or development build

## Test Scenarios

### 1. SSH Remote Development

#### Setup

1. Connect to a remote server via SSH:

   - Open VS Code
   - Press `F1` → "Remote-SSH: Connect to Host..."
   - Select or add an SSH host

2. Install beans CLI on the remote server:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/h-arry-smith/beans/main/install.sh | sh
   # OR use package manager
   ```

3. Install the extension in the remote environment:
   - Open extensions panel in remote VS Code
   - Install from `.vsix` or marketplace

#### Verification Checklist

- [ ] Extension activates in SSH remote
- [ ] `beans --version` works in integrated terminal
- [ ] Can initialize beans workspace: `Beans: Initialize Beans in Workspace`
- [ ] Tree views populate with bean data
- [ ] Can create/edit/view beans via commands
- [ ] MCP server starts if AI features enabled
- [ ] Chat participant (`@beans`) responds to commands
- [ ] Generated files (`.github/skills/beans/SKILL.md`) saved to remote filesystem
- [ ] Output channel logs correctly

#### Expected Behavior

- Extension icon appears in remote sidebar
- All file operations target remote filesystem
- CLI invocation uses remote PATH
- No local filesystem access attempted

---

### 2. WSL (Windows Subsystem for Linux)

#### Setup

1. Install WSL on Windows:

   ```powershell
   wsl --install
   ```

2. Open folder in WSL:

   - `F1` → "WSL: Connect to WSL"
   - Or click "Open Folder" → select WSL path

3. Install beans CLI in WSL:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/h-arry-smith/beans/main/install.sh | sh
   ```

4. Install extension in WSL environment

#### Verification Checklist

- [ ] Extension activates in WSL
- [ ] Beans CLI found in WSL PATH
- [ ] Can initialize and use beans normally
- [ ] Tree views and commands work
- [ ] MCP integration functional
- [ ] File paths resolve correctly (no Windows/Linux path mixing)
- [ ] `.beans.yml` read/write works
- [ ] Beans workspace operations complete successfully

#### Common Issues

- **PATH not set**: Add beans to `~/.profile` or `~/.bashrc`
- **Windows PATH pollution**: Ensure WSL uses its own PATH
- **File permission issues**: Check workspace folder ownership

---

### 3. Dev Containers

#### Setup

1. Create test `.devcontainer/devcontainer.json`:

   ```json
   {
     "name": "Beans Test Container",
     "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
     "postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/h-arry-smith/beans/main/install.sh | sh && beans init",
     "customizations": {
       "vscode": {
         "extensions": ["selfagency.beans-vscode"],
         "settings": {
           "beans.ai.enabled": true
         }
       }
     }
   }
   ```

2. Reopen in container:
   - `F1` → "Dev Containers: Reopen in Container"

#### Verification Checklist

- [ ] Container builds successfully
- [ ] Beans CLI installed during `postCreateCommand`
- [ ] Extension auto-installed in container
- [ ] Workspace initialized automatically
- [ ] All features work in container environment
- [ ] MCP server spawns correctly
- [ ] Logs accessible via output channel
- [ ] Files persist when rebuilding container (if using volumes)

#### Container-Specific Tests

- [ ] Rebuild container → beans data persists (with proper volumes)
- [ ] Multiple containers can use extension concurrently
- [ ] Resource limits don't affect extension performance
- [ ] Network access works for any external integrations

---

### 4. GitHub Codespaces

#### Setup

1. Create or open repository in Codespaces
2. Add `.devcontainer/devcontainer.json` (same as Dev Containers example)
3. Create or restart Codespace

#### Verification Checklist

- [ ] Extension auto-installs in Codespace
- [ ] Beans CLI accessible
- [ ] Can initialize beans workspace
- [ ] All features functional
- [ ] MCP integration works
- [ ] Chat participant available
- [ ] Generated skill files committed to repo
- [ ] Performance acceptable on Codespace resources

#### Codespace-Specific Tests

- [ ] Stop/start Codespace → extension state preserved
- [ ] Multiple Codespaces of same repo → independent bean states
- [ ] Secrets/env vars passed correctly if needed
- [ ] Port forwarding works if extension needs network access

---

## Cross-Scenario Validation

Test these scenarios across ALL remote environments:

### Extension Lifecycle

- [ ] Activates on startup if `.beans.yml` exists
- [ ] Shows init prompt if no `.beans.yml`
- [ ] Graceful degradation if beans CLI missing
- [ ] Extension deactivates cleanly
- [ ] No memory leaks during long sessions

### Core Functionality

- [ ] List beans in tree views
- [ ] Create new beans
- [ ] Edit bean metadata (status, type, priority)
- [ ] Set parent relationships
- [ ] Edit blocking relationships
- [ ] Delete beans (scrapped/draft only)
- [ ] Filter and search beans
- [ ] Copy bean IDs

### AI Integration

- [ ] MCP server definition published
- [ ] Copilot can see MCP tools
- [ ] Chat participant responds
- [ ] Skill file generated and updated
- [ ] Instructions file generated and updated

### Error Handling

- [ ] CLI not found → clear error message with install guidance
- [ ] Workspace not initialized → prompt with action
- [ ] Invalid bean data → graceful error, doesn't crash extension
- [ ] Network timeouts → appropriate timeout messages
- [ ] Permission errors → clear user guidance

### Performance

- [ ] Extension activates within 2 seconds
- [ ] Tree view populates within 1 second for <100 beans
- [ ] Commands respond within 500ms
- [ ] No UI blocking during CLI operations
- [ ] Memory usage stays reasonable (<100MB typical)

---

## Debugging Remote Issues

### Enable Extension Host Logs

1. `F1` → "Developer: Set Log Level..."
2. Select "Trace"
3. `F1` → "Developer: Show Logs..."
4. Select "Extension Host"

### Check Beans Output Channel

1. View → Output
2. Select "Beans" from dropdown
3. Look for activation, CLI invocation, errors

### Verify Extension Running Remotely

```bash
# In VS Code integrated terminal (connected to remote)
ps aux | grep "extensionHost"  # Should show process on remote
echo $VSCODE_IPC_HOOK_CLI      # Should show remote socket path
```

### Common Remote Issues

| Issue                  | Symptom               | Solution                                        |
| ---------------------- | --------------------- | ----------------------------------------------- |
| CLI not in PATH        | "Beans CLI not found" | Add beans to PATH or configure `beans.cliPath`  |
| Extension runs locally | Features don't work   | Check `extensionKind` in package.json           |
| MCP server fails       | Tools not available   | Check MCP logs, verify Node.js on remote        |
| File operations fail   | Errors saving beans   | Check workspace folder permissions              |
| Slow performance       | Commands timeout      | Check remote machine resources, network latency |

---

## Automated Remote Testing

### Docker-Based Testing

Create a test script that:

1. Builds container with beans CLI
2. Installs extension
3. Runs automated command tests
4. Validates output

Example `test-remote.sh`:

```bash
#!/bin/bash
set -e

# Build test container
docker build -t beans-vscode-test -f Dockerfile.test .

# Run tests in container
docker run --rm \
  -v "$PWD:/workspace" \
  beans-vscode-test \
  /bin/bash -c "
    cd /workspace
    beans init
    beans create 'Test Issue' -t task -s todo
    beans list --json | jq '.[] | select(.title == \"Test Issue\")'
  "

echo "✓ Remote container test passed"
```

---

## Reporting Remote Issues

When reporting bugs specific to remote scenarios, include:

- Remote environment type (SSH/WSL/Container/Codespaces)
- Host OS and remote OS
- VS Code version
- Extension version
- Beans CLI version (from remote: `beans --version`)
- Output channel logs (View → Output → Beans)
- Extension host logs (if relevant)
- Steps to reproduce in remote environment

---

## CI/CD Remote Testing

The extension's CI workflow tests on multiple OS platforms, but cannot test true remote scenarios. Consider:

- Manual testing checklist before releases
- Automated Docker-based tests in CI
- Community testing program for diverse environments
- Telemetry to detect remote usage patterns (with privacy considerations)

---

## Summary

Remote development is fully supported. All features should work identically to local development, with the key requirement being that **beans CLI must be installed on the remote machine**.

If you encounter issues not covered in this guide, please report them with detailed environment information.
