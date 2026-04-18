import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBeansCopilotInstructions,
  COPILOT_INSTRUCTIONS_RELATIVE_PATH,
  writeBeansCopilotInstructions,
} from '../../../beans/config';

vi.mock('node:fs/promises');

describe('buildBeansCopilotInstructions', () => {
  it('generates extension-first instructions with planning mode and CLI fallback', () => {
    const content = buildBeansCopilotInstructions('');

    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toContain('title: Beans Task Management Rules');
    expect(content).toContain('description: Generated Copilot instructions for Beans workflows in this workspace.');
    expect(content).not.toContain('Template: copilot-instructions.template.md');
    expect(content).toContain('<CRITICALLY_IMPORTANT>');
    expect(content).toContain('# Beans Task Management Rules');
    expect(content).toContain('## Beans Usage Guide for Agents (Extension-First)');
    expect(content).toContain('## Interface priority (highest → lowest)');
    expect(content).toContain('## Planning mode for epic decomposition');
    expect(content).toContain('## CLI fallback (only when extension, chat, and MCP are all unavailable)');
    expect(content).toContain('If the issue does not already have a branch, create one when you begin work');
    expect(content).toContain('If you are resuming work, checkout the existing branch for that issue first');
    expect(content).toContain(
      'Branch names must follow Git Flow topic branch conventions aligned to bean type and urgency'
    );
    expect(content).toContain(
      'Examples: `feature/beans-vscode-1234-add-search`, `bugfix/beans-vscode-987-fix-init-crash`, `hotfix/beans-vscode-321-patch-login-outage`'
    );
    expect(content).toContain('Push the branch and record it in the bean frontmatter as soon as it exists');
    expect(content).toContain('.agents/skills/beans-vscode/SKILL.md');
    expect(content).toContain('Always use beans instead of TodoWrite');
    expect(content).toContain('`beans_query` with `operation: "llm_context"`');
    expect(content).not.toContain('beans_vscode_llm_context');
  });
});

describe('writeBeansCopilotInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes instructions to the expected location', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue();

    const result = await writeBeansCopilotInstructions('/workspace', 'instructions');
    const expectedPath = path.join('/workspace', COPILOT_INSTRUCTIONS_RELATIVE_PATH);

    expect(result).toBe(expectedPath);
    expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(expectedPath), { recursive: true });
    expect(writeFileSpy).toHaveBeenCalledWith(expectedPath, 'instructions', 'utf8');
  });
});
