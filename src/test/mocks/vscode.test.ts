import { describe, expect, it } from 'vitest';
import { Uri, window, workspace, env, RelativePattern, EventEmitter } from './vscode.js';

describe('test/mocks/vscode', () => {
  it('parses URIs and exposes fsPath', () => {
    const uri = Uri.parse('/tmp/file.txt');
    expect(uri.scheme).toBe('file');
    expect(uri.fsPath).toBe('/tmp/file.txt');
  });

  it('returns undefined for informational/warning/error message helpers', async () => {
    await expect(window.showInformationMessage('info')).resolves.toBeUndefined();
    await expect(window.showWarningMessage('warn')).resolves.toBeUndefined();
    await expect(window.showErrorMessage('error')).resolves.toBeUndefined();
  });

  it('provides disposable tree/webview registration stubs', () => {
    expect(window.registerTreeDataProvider().dispose).toBeTypeOf('function');
    expect(window.registerWebviewViewProvider().dispose).toBeTypeOf('function');
  });

  it('returns workspace configuration defaults and findFiles empty list', async () => {
    const config = workspace.getConfiguration();
    expect(config.get('missing')).toBeUndefined();
    expect(config.has('missing')).toBe(false);
    expect(config.inspect('missing')).toBeUndefined();
    await expect(config.update('k', 'v')).resolves.toBeUndefined();
    await expect(workspace.findFiles()).resolves.toEqual([]);
  });

  it('provides watcher and config-change disposable stubs', () => {
    const watcher = workspace.createFileSystemWatcher();
    expect(watcher.onDidCreate().dispose).toBeTypeOf('function');
    expect(watcher.onDidChange().dispose).toBeTypeOf('function');
    expect(watcher.onDidDelete().dispose).toBeTypeOf('function');
    expect(watcher.dispose).toBeTypeOf('function');
    expect(workspace.onDidChangeConfiguration().dispose).toBeTypeOf('function');
  });

  it('returns success for openExternal', async () => {
    await expect(env.openExternal()).resolves.toBe(true);
  });

  it('stores RelativePattern constructor values', () => {
    const pattern = new RelativePattern('/tmp', '*.ts');
    expect(pattern.base).toBe('/tmp');
    expect(pattern.pattern).toBe('*.ts');
  });

  it('supports EventEmitter subscribe/fire/dispose', () => {
    const events: string[] = [];
    const emitter = new EventEmitter<string>();
    emitter.event(value => events.push(value));
    emitter.fire('first');
    emitter.dispose();
    emitter.fire('second');

    expect(events).toEqual(['first']);
  });
});
