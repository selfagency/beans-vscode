import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../../src/beans/details/BeansDetailsViewProvider';

describe('BeansDetailsViewProvider.handleBeanUpdate payload validation', () => {
  it('forwards only whitelisted keys to service.updateBean', async () => {
    const fakeService = { updateBean: vi.fn().mockResolvedValue({}) } as any;
    const provider = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), fakeService);

    // set current bean so handler proceeds
    (provider as any)._currentBean = { id: 'n2u0' };

    const payload = { title: 'New title', unexpected: true, priority: 'high' };

    // call private method
    await (provider as any).handleBeanUpdate(payload);

    expect(fakeService.updateBean).toHaveBeenCalledTimes(1);
    const [, sent] = (fakeService.updateBean as any).mock.calls[0];
    expect(sent).toEqual({ title: 'New title', priority: 'high' });
  });

  it('ignores non-object payloads and does not call service.updateBean', async () => {
    const fakeService = { updateBean: vi.fn().mockResolvedValue({}) } as any;
    const provider = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), fakeService);
    (provider as any)._currentBean = { id: 'n2u0' };

    await (provider as any).handleBeanUpdate(null);
    await (provider as any).handleBeanUpdate('string');

    expect(fakeService.updateBean).not.toHaveBeenCalled();
  });
});
