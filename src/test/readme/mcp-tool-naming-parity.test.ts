import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('MCP tool naming parity docs guard', () => {
  it('uses beans_* names in user docs and avoids stale beans_vscode_* names', () => {
    const aiDoc = readWorkspaceFile('docs/users/ai.md');
    const mcpDoc = readWorkspaceFile('docs/users/mcp-integration.md');
    const commandsDoc = readWorkspaceFile('docs/users/commands.md');

    expect(aiDoc).toContain('`beans_query`');
    expect(aiDoc).toContain('`beans_bulk_create`');
    expect(mcpDoc).toContain('`beans_query`');
    expect(mcpDoc).toContain('`beans_bulk_create`');
    expect(mcpDoc).toContain('`beans_bulk_update`');
    expect(commandsDoc).toContain('`beans_query`');
    expect(commandsDoc).toContain('`beans_bulk_create`');

    expect(aiDoc).not.toContain('beans_vscode_');
    expect(mcpDoc).not.toContain('beans_vscode_');
    expect(commandsDoc).not.toContain('beans_vscode_');
  });

  it('keeps revised llm_context artifact guidance in MCP docs', () => {
    const mcpDoc = readWorkspaceFile('docs/users/mcp-integration.md');

    expect(mcpDoc).toContain('"instructionsPath": "/workspace/.github/instructions/beans-prime.instructions.md"');
    expect(mcpDoc).toContain(
      "extension's own initialization flow still generates `.github/instructions/tasks.instructions.md`"
    );
  });
});
