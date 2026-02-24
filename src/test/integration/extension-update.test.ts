import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { checkForExtensionUpdateAndPrompt } from '../../extension';

function makeContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    extensionUri: vscode.Uri.file('/ext'),
    extensionPath: '/ext',
    logUri: vscode.Uri.file('/ext-logs'),
    extension: { packageJSON: { version: '1.3.4' } },
    workspaceState: {
      get: vi.fn(() => undefined),
      update: vi.fn(async () => undefined),
    },
  } as unknown as vscode.ExtensionContext;
}

describe('checkForExtensionUpdateAndPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no last-initialized version is recorded', async () => {
    const ctx = makeContext();
    (ctx.workspaceState.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const showInfo = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);
    await checkForExtensionUpdateAndPrompt(ctx);
    expect(showInfo).not.toHaveBeenCalled();
  });

  it('prompts and runs reinit when versions differ and workspace is trusted', async () => {
    const ctx = makeContext();
    (ctx.workspaceState.get as ReturnType<typeof vi.fn>).mockReturnValue('1.2.0');

    vi.spyOn(vscode.workspace, 'isTrusted', 'get').mockReturnValue(true as any);
    const showInfo = vi
      .spyOn(vscode.window, 'showInformationMessage')
      .mockResolvedValue('Reinitialize now (regenerates instructions & skill)' as any);
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);

    await checkForExtensionUpdateAndPrompt(ctx);

    expect(showInfo).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('beans.reinitializeCopilotArtifacts');
    expect(ctx.workspaceState.update).toHaveBeenCalledWith('beans.lastInitializedExtensionVersion', '1.3.4');
  });

  it('asks to trust workspace when not trusted', async () => {
    const ctx = makeContext();
    (ctx.workspaceState.get as ReturnType<typeof vi.fn>).mockReturnValue('1.2.0');

    vi.spyOn(vscode.workspace, 'isTrusted', 'get').mockReturnValue(false as any);
    const showInfo = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Trust Workspace' as any);
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);

    await checkForExtensionUpdateAndPrompt(ctx);

    expect(showInfo).toHaveBeenCalled();
    // Should attempt to open workspace trust UI
    expect(exec).toHaveBeenCalled();
  });
});
