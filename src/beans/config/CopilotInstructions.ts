import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import template from './templates/copilot-instructions.template.md';

export const COPILOT_INSTRUCTIONS_RELATIVE_PATH = path.join('.github', 'instructions', 'tasks.instructions.md');

export function buildBeansCopilotInstructions(primeOutput: string): string {
  return template.replace('{{PRIME_OUTPUT}}', primeOutput.trim());
}

export async function writeBeansCopilotInstructions(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_INSTRUCTIONS_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
}
