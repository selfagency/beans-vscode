import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import template from './templates/copilot-skill.template.md';

export const COPILOT_SKILL_RELATIVE_PATH = path.join('.github', 'skills', 'beans', 'SKILL.md');

export function buildBeansCopilotSkill(primeOutput: string): string {
  return template.replace('{{PRIME_OUTPUT}}', primeOutput.trim());
}

export async function writeBeansCopilotSkill(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
}

export async function removeBeansCopilotSkill(workspaceRoot: string): Promise<void> {
  const absolutePath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
  await fs.rm(absolutePath, { force: true });
}
