import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../../src/beans/details/BeansDetailsViewProvider';

describe('BeansDetailsViewProvider.sanitizeAndValidateUpdates', () => {
  it('keeps only valid fields and maps empty priority to undefined', () => {
    const prov = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    const payload = { status: 'in-progress', type: 'feature', priority: '', title: 'Hi', body: 'desc' };
    const out = (prov as any).sanitizeAndValidateUpdates(payload);
    expect(out).toEqual({ status: 'in-progress', type: 'feature', priority: undefined, title: 'Hi', body: 'desc' });
  });

  it('strips invalid enum values', () => {
    const prov = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    const payload = { status: 'bad-status', type: 'feature', priority: 'high' };
    const out = (prov as any).sanitizeAndValidateUpdates(payload);
    expect(out).toEqual({ type: 'feature', priority: 'high' });
  });

  it('rejects overly long titles and empty titles', () => {
    const prov = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    const long = 'x'.repeat(501);
    expect((prov as any).sanitizeAndValidateUpdates({ title: long })).toEqual({});
    expect((prov as any).sanitizeAndValidateUpdates({ title: '' })).toEqual({});
  });

  it('returns undefined for non-object or array payloads', () => {
    const prov = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    expect((prov as any).sanitizeAndValidateUpdates(null)).toBeUndefined();
    expect((prov as any).sanitizeAndValidateUpdates('string' as any)).toBeUndefined();
    expect((prov as any).sanitizeAndValidateUpdates([1, 2, 3] as any)).toBeUndefined();
  });
});
