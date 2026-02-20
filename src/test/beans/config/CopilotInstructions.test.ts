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
    expect(content).toContain('# Beans Usage Guide for Agents (Extension-First)');
    expect(content).toContain('## Interface priority (highest → lowest)');
    expect(content).toContain('## Planning mode for epic decomposition');
    expect(content).toContain('## CLI fallback (only when extension, chat, and MCP are all unavailable)');
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
