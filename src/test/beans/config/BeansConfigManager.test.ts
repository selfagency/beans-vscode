import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansConfigManager } from '../../../beans/config/BeansConfigManager';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('vscode', () => ({
  workspace: {
    findFiles: vi.fn(),
    openTextDocument: vi.fn(),
  },
  window: {
    showWarningMessage: vi.fn(),
    showTextDocument: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

describe('BeansConfigManager', () => {
  let manager: BeansConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BeansConfigManager('/mock/workspace');
  });

  describe('exists', () => {
    it('returns true when .beans.yml exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await expect(manager.exists()).resolves.toBe(true);
    });

    it('returns false when .beans.yml does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(manager.exists()).resolves.toBe(false);
    });
  });

  describe('read', () => {
    it('returns null when no config file is found', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await expect(manager.read()).resolves.toBeNull();
    });

    it('parses and returns config object', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([{} as any]);
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({
        getText: () =>
          [
            'beans:',
            '  path: .beans',
            '  prefix: abc',
            '  id_length: 4',
            '  default_status: todo',
            '  default_type: task',
            '  created_at: 2026-02-17',
          ].join('\n'),
      } as any);

      const result = await manager.read();

      expect(result).toEqual({
        path: '.beans',
        prefix: 'abc',
        id_length: 4,
        default_status: 'todo',
        default_type: 'task',
        created_at: expect.any(Date),
      });
      expect((result as any).created_at).toBeInstanceOf(Date);
    });

    it('returns null and logs warning when parsed value is non-object', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([{} as any]);
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({
        getText: () => 'true',
      } as any);

      await expect(manager.read()).resolves.toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('.beans.yml parsed to non-object value');
    });

    it('returns null and logs error on read failure', async () => {
      vi.mocked(vscode.workspace.findFiles).mockRejectedValue(new Error('read failed'));

      await expect(manager.read()).resolves.toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to read .beans.yml:', expect.any(Error));
    });
  });

  describe('open', () => {
    it('shows warning when config file is missing', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await manager.open();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('.beans.yml not found in workspace');
    });

    it('opens config in editor and logs info when file exists', async () => {
      const doc = { uri: { path: '/mock/workspace/.beans.yml' } } as any;
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([{} as any]);
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);

      await manager.open();

      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(doc);
      expect(mockLogger.info).toHaveBeenCalledWith('Opened .beans.yml in editor');
    });

    it('shows error message when open fails', async () => {
      vi.mocked(vscode.workspace.findFiles).mockRejectedValue(new Error('boom'));

      await manager.open();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to open .beans.yml: boom');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to open .beans.yml: boom', expect.any(Error));
    });
  });

  describe('update', () => {
    it('opens editor and shows follow-up guidance', async () => {
      const openSpy = vi.spyOn(manager, 'open').mockResolvedValue();

      await manager.update();

      expect(openSpy).toHaveBeenCalledOnce();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Please edit .beans.yml and save. Changes will be reflected after save.',
        'OK'
      );
    });
  });
});
