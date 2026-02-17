import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildBeansCopilotInstructions,
  COPILOT_INSTRUCTIONS_RELATIVE_PATH,
  writeBeansCopilotInstructions,
} from '../../../beans/config';

vi.mock('node:fs/promises');

describe('buildBeansCopilotInstructions', () => {
  it('generates extension-first instructions with planning mode and CLI fallback', () => {
    const content = buildBeansCopilotInstructions('beans prime output');

    expect(content).toContain('<EXTREMELY_IMPORTANT>');
    expect(content).toContain('# Beans Task Management Rules');
    expect(content).toContain('# Beans Usage Guide for Agents (Extension-First)');
    expect(content).toContain('## Interface priority (highest → lowest)');
    expect(content).toContain('## Planning mode for epic decomposition');
    expect(content).toContain('## CLI fallback (only when extension/chat/MCP are unavailable)');
    expect(content).toContain('beans prime output');
  });

  it('trims prime output in the embedded text block', () => {
    const content = buildBeansCopilotInstructions(' \n  trimmed prime \n ');
    const primeBlockMatch = content.match(/```text\n([\s\S]*?)\n```/);

    expect(primeBlockMatch?.[1]).toBe('trimmed prime');
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
