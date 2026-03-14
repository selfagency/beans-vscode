import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(`${ROOT}/${relativePath}`, 'utf8');
}

describe('MCP tool naming parity docs guard', () => {
  it('uses beans_* names in user docs and avoids stale beans_vscode_* names', () => {
    const aiDoc = readWorkspaceFile('docs/users/ai.md');
    const mcpDoc = readWorkspaceFile('docs/users/mcp-integration.md');
    const commandsDoc = readWorkspaceFile('docs/users/commands.md');

    expect(aiDoc).toContain('`beans_query`');
    expect(mcpDoc).toContain('`beans_query`');
    expect(commandsDoc).toContain('`beans_query`');

    expect(aiDoc).not.toContain('beans_vscode_');
    expect(mcpDoc).not.toContain('beans_vscode_');
    expect(commandsDoc).not.toContain('beans_vscode_');
  });

  it('keeps GraphQL-based llm_context source guidance in MCP docs', () => {
    const mcpDoc = readWorkspaceFile('docs/users/mcp-integration.md');

    expect(mcpDoc).toContain('"sourceCommand": "beans graphql --schema"');
    expect(mcpDoc).toContain('"instructionsPath": "/workspace/.github/instructions/tasks.instructions.md"');
  });
});
