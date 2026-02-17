import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildBeansCopilotSkill,
  writeBeansCopilotSkill,
  removeBeansCopilotSkill,
  COPILOT_SKILL_RELATIVE_PATH,
} from '../../../beans/config';

// Mock fs module
vi.mock('node:fs/promises');

describe('CopilotSkill', () => {
  describe('COPILOT_SKILL_RELATIVE_PATH', () => {
    it('should have correct path structure', () => {
      expect(COPILOT_SKILL_RELATIVE_PATH).toBe(path.join('.github', 'skills', 'beans', 'SKILL.md'));
    });
  });

  describe('buildBeansCopilotSkill', () => {
    it('creates compact skill content with required frontmatter fields and planning guidance', () => {
      const content = buildBeansCopilotSkill('beans prime output');

      expect(content).toContain('name: beans');
      expect(content).toContain('description: Use for Beans issue tracker workflows');
      expect(content).toContain('# Beans Skill');
      expect(content).toContain('## Planning mode: map and create epic issues');
      expect(content).toContain('### Planning output format');
      expect(content).toContain('beans prime output');
    });

    it('should include VS Code command references', () => {
      const content = buildBeansCopilotSkill('prime data');

      expect(content).toContain('## VS Code command surface');
      expect(content).toContain('beans.view');
      expect(content).toContain('beans.create');
      expect(content).toContain('beans.setStatus');
    });

    it('should include workflow guidance', () => {
      const content = buildBeansCopilotSkill('');

      expect(content).toContain('## Use Beans as source of truth');
      expect(content).toContain('## Recommended workflow');
      expect(content).toContain('Read current state before mutating');
    });

    it('should trim prime output', () => {
      const content = buildBeansCopilotSkill('  \n\n  trimmed content  \n  ');
      const primeBlockMatch = content.match(/```text\n([\s\S]*?)\n```/);

      expect(content).toContain('trimmed content');
      expect(primeBlockMatch?.[1]).toBe('trimmed content');
    });

    it('should embed prime output in code block', () => {
      const content = buildBeansCopilotSkill('prime content');

      expect(content).toContain('```text\nprime content\n```');
    });

    it('should include planning format guidance', () => {
      const content = buildBeansCopilotSkill('');

      expect(content).toContain('- [ ] <title> — type=<type>, priority=<priority>, depends_on=<ids or none>');
      expect(content).toContain('After approval, create issues and reply with:');
      expect(content).toContain('Suggested first issue:');
    });
  });

  describe('writeBeansCopilotSkill', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should write skill file to correct path', async () => {
      const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue();

      const workspaceRoot = '/workspace';
      const content = 'skill content';

      const result = await writeBeansCopilotSkill(workspaceRoot, content);

      expect(result).toBe(path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH));
      expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(result), { recursive: true });
      expect(writeFileSpy).toHaveBeenCalledWith(result, content, 'utf8');
    });

    it('should create parent directories recursively', async () => {
      const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue();

      await writeBeansCopilotSkill('/workspace', 'content');

      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('.github/skills/beans'), { recursive: true });
    });

    it('should handle mkdir errors', async () => {
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'mkdir').mockRejectedValue(error);

      await expect(writeBeansCopilotSkill('/workspace', 'content')).rejects.toThrow('Permission denied');
    });

    it('should handle writeFile errors', async () => {
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      const error = new Error('Disk full');
      vi.spyOn(fs, 'writeFile').mockRejectedValue(error);

      await expect(writeBeansCopilotSkill('/workspace', 'content')).rejects.toThrow('Disk full');
    });

    it('should work with different workspace roots', async () => {
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue();

      const result1 = await writeBeansCopilotSkill('/workspace1', 'content1');
      const result2 = await writeBeansCopilotSkill('/workspace2', 'content2');

      expect(result1).toContain('/workspace1/');
      expect(result2).toContain('/workspace2/');
      expect(writeFileSpy).toHaveBeenNthCalledWith(1, result1, 'content1', 'utf8');
      expect(writeFileSpy).toHaveBeenNthCalledWith(2, result2, 'content2', 'utf8');
    });
  });

  describe('removeBeansCopilotSkill', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should remove skill file at correct path', async () => {
      const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue();

      const workspaceRoot = '/workspace';
      await removeBeansCopilotSkill(workspaceRoot);

      const expectedPath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
      expect(rmSpy).toHaveBeenCalledWith(expectedPath, { force: true });
    });

    it('should use force option to ignore missing files', async () => {
      const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue();

      await removeBeansCopilotSkill('/workspace');

      expect(rmSpy).toHaveBeenCalledWith(expect.any(String), { force: true });
    });

    it('should not throw if file does not exist', async () => {
      vi.spyOn(fs, 'rm').mockResolvedValue();

      await expect(removeBeansCopilotSkill('/workspace')).resolves.toBeUndefined();
    });

    it('should handle rm errors when force does not suppress them', async () => {
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'rm').mockRejectedValue(error);

      await expect(removeBeansCopilotSkill('/workspace')).rejects.toThrow('Permission denied');
    });

    it('should work with different workspace roots', async () => {
      const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue();

      await removeBeansCopilotSkill('/workspace1');
      await removeBeansCopilotSkill('/workspace2');

      expect(rmSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('/workspace1/'), { force: true });
      expect(rmSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('/workspace2/'), { force: true });
    });
  });
});
