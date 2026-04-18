import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import template from './templates/copilot-skill.template.md';

export const COPILOT_SKILL_RELATIVE_PATH = path.join('.agents', 'skills', 'beans-vscode', 'SKILL.md');
export const LEGACY_COPILOT_SKILL_RELATIVE_PATH = path.join('.github', 'skills', 'beans', 'SKILL.md');

export function buildBeansCopilotSkill(graphqlSchema: string): string {
  return template.replace('{{GRAPHQL_SCHEMA}}', graphqlSchema.trim());
}

export async function writeBeansCopilotSkill(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  if (LEGACY_COPILOT_SKILL_RELATIVE_PATH !== COPILOT_SKILL_RELATIVE_PATH) {
    await fs.rm(path.join(workspaceRoot, LEGACY_COPILOT_SKILL_RELATIVE_PATH), { force: true });
  }
  return absolutePath;
}

export async function removeBeansCopilotSkill(workspaceRoot: string): Promise<void> {
  await fs.rm(path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH), { force: true });
  if (LEGACY_COPILOT_SKILL_RELATIVE_PATH !== COPILOT_SKILL_RELATIVE_PATH) {
    await fs.rm(path.join(workspaceRoot, LEGACY_COPILOT_SKILL_RELATIVE_PATH), { force: true });
  }
}
