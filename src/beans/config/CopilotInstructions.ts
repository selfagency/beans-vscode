import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const COPILOT_INSTRUCTIONS_RELATIVE_PATH = path.join('.github', 'instructions', 'beans.instructions.md');

export function buildBeansCopilotInstructions(primeOutput: string): string {
  const normalizedPrime = primeOutput.trim();

  return `# Beans + VS Code Extension Agent Instructions

This file is generated from \`beans prime\` and extension metadata to help LLM agents work effectively in this repository.

## Priority workflow

1. Use the **Beans CLI** as the source of truth for planning and progress tracking.
2. Prefer **extension commands** (or their MCP tool equivalents) over ad-hoc edits for bean operations.
3. In Copilot Chat, use the Beans MCP provider and tools for structured actions.

## VS Code extension usage

Use extension commands for day-to-day workflows:

- \`beans.init\`
- \`beans.view\`, \`beans.create\`, \`beans.edit\`
- \`beans.setStatus\`, \`beans.setType\`, \`beans.setPriority\`
- \`beans.setParent\`, \`beans.removeParent\`, \`beans.editBlocking\`
- \`beans.copyId\`, \`beans.delete\`
- \`beans.filter\`, \`beans.search\`, \`beans.sort\`, \`beans.refresh\`

## MCP integration usage

The extension publishes an MCP stdio server via provider \`beans.mcpServers\`.

Recommended tool flow for LLMs:

- Fetch project guidance context first with \`beans_vscode_llm_context\`.
- Use read tools (\`beans_vscode_refresh\`, \`beans_vscode_view\`, \`beans_vscode_search\`, \`beans_vscode_filter\`, \`beans_vscode_sort\`) before mutating.
- Use mutation tools (\`beans_vscode_create\`, \`beans_vscode_edit\`, \`beans_vscode_set_*\`, \`beans_vscode_delete\`) with explicit user intent.

## Chat integration guidance

- In Copilot Chat, prefer Beans MCP tools for reproducible and auditable operations.
- For destructive actions (for example \`beans_vscode_delete\`), ask for confirmation unless explicitly requested.

## Beans CLI baseline (from \`beans prime\`)

\`\`\`text
${normalizedPrime}
\`\`\`
`;
}

export async function writeBeansCopilotInstructions(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_INSTRUCTIONS_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
}
