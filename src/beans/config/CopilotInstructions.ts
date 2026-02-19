/**
 * Module: beans/config (Copilot instructions)
 *
 * Helpers for building and writing Copilot instruction artifacts used by the
 * Copilot/Chat prompt generation flow. Templates live under
 * `src/beans/config/templates/*` and use a single placeholder `{{GRAPHQL_SCHEMA}}`.
 *
 * NOTE: Tests import the markdown templates directly via a .md loader (see
 * `vitest.config.ts`), so keep the placeholder exact and avoid additional
 * interpolation logic in templates.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import template from './templates/copilot-instructions.template.md';

export const COPILOT_INSTRUCTIONS_RELATIVE_PATH = path.join('.github', 'instructions', 'tasks.instructions.md');

export function buildBeansCopilotInstructions(graphqlSchema: string): string {
  return template.replace('{{GRAPHQL_SCHEMA}}', graphqlSchema.trim());
}

export async function writeBeansCopilotInstructions(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_INSTRUCTIONS_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
}
