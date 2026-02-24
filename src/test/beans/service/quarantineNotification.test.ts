import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansService } from '../../../../src/beans/service/BeansService';

describe('BeansService.notifyMalformedBeanQuarantined', () => {
  let showWarningSpy: ReturnType<typeof vi.spyOn>;
  let openTextDocSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    showWarningSpy = vi.spyOn(vscode.window, 'showWarningMessage');
    openTextDocSpy = vi.spyOn(vscode.workspace, 'openTextDocument');
  });

  afterEach(() => {
    showWarningSpy.mockRestore();
    openTextDocSpy.mockRestore();
  });

  it('shows concise filename-only notification when quarantinedPath provided', () => {
    const svc = new BeansService('/tmp');
    const rawBean: any = { path: '.beans/foobar.md', id: 'foobar' };
    const quarantined = path.join('/tmp', '.beans', '.quarantine', 'foobar.md.fixme');

    (svc as any).notifyMalformedBeanQuarantined(rawBean, quarantined);

    expect(showWarningSpy).toHaveBeenCalled();
    const msg = showWarningSpy.mock.calls[0][0] as string;
    expect(msg).toContain('Bean file quarantined:');
    expect(msg).toContain('foobar.md.fixme');
    // Ensure the message does not include the full absolute path
    expect(msg).not.toContain('/tmp');
  });

  it('shows concise message when quarantinedPath not provided', () => {
    const svc = new BeansService('/tmp');
    const rawBean: any = { path: '.beans/some/dir/baz.md', id: 'baz' };

    (svc as any).notifyMalformedBeanQuarantined(rawBean, undefined);

    expect(showWarningSpy).toHaveBeenCalled();
    const msg = showWarningSpy.mock.calls[0][0] as string;
    expect(msg).toContain('Bean file quarantined:');
    // Should use basename only
    expect(msg).toContain('baz.md');
    expect(msg.startsWith('Bean file quarantined:')).toBe(true);
  });
});
