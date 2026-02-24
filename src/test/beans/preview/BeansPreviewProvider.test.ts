import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { Bean } from '../../../beans/model';
import { BeansPreviewProvider } from '../../../beans/preview/BeansPreviewProvider';

// TODO(beans-vscode-9q1k): Add markdown snapshot tests with strict locale/time
// controls and edge-case content escaping to validate rendered preview output
// more deeply than string-contains checks.
const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('vscode', async () => {
  return await import('../../mocks/vscode.js');
});

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'bean-1',
    code: 'ABC',
    slug: 'bean-1',
    path: '.beans/bean-1.md',
    title: 'Preview title',
    body: 'Body content',
    status: 'todo',
    type: 'task',
    priority: 'normal',
    parent: undefined,
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    etag: 'etag-1',
    ...overrides,
  } as Bean;
}

describe('BeansPreviewProvider', () => {
  let service: { showBean: ReturnType<typeof vi.fn> };
  let provider: BeansPreviewProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    service = {
      showBean: vi.fn(),
    };
    provider = new BeansPreviewProvider(service as any);
  });

  it('returns error markdown when bean ID is missing', async () => {
    const uri = { query: '' } as vscode.Uri;

    await expect(provider.provideTextDocumentContent(uri)).resolves.toContain('No bean ID provided');
    expect(service.showBean).not.toHaveBeenCalled();
  });

  it('renders full bean preview when bean is found', async () => {
    const previewBean = makeBean({
      status: 'in-progress',
      type: 'feature',
      priority: 'high',
      parent: 'epic-1',
      tags: ['frontend', 'ux'],
      blocking: ['bean-2'],
      blockedBy: ['bean-3'],
    });
    service.showBean.mockResolvedValue(previewBean);

    const content = await provider.provideTextDocumentContent({ query: 'bean-1' } as vscode.Uri);

    expect(content).toContain('# Preview title');
    expect(content).toContain('**ID:** `bean-1` | **Code:** `ABC`');
    // No external shields.io requests — badges should be rendered inline
    expect(content).not.toContain('img.shields.io');
    // Inline badge HTML should include the status and type labels
    expect(content).toContain('in-progress');
    expect(content).toContain('feature');
    expect(content).toContain('**Parent:** epic-1');
    expect(content).toContain('**Blocking:** bean-2');
    expect(content).toContain('**Blocked by:** bean-3');
    expect(content).toContain('**Tags:** `frontend`, `ux`');
    expect(content).toContain('Body content');
  });

  it('renders placeholder body when description is empty', async () => {
    service.showBean.mockResolvedValue(
      makeBean({
        body: '   ',
        priority: undefined,
      })
    );

    const content = await provider.provideTextDocumentContent({ query: 'bean-1' } as vscode.Uri);

    expect(content).toContain('_No description provided._');
    expect(content).not.toContain('![undefined]');
  });

  it('returns error markdown and logs when showBean fails', async () => {
    service.showBean.mockRejectedValue(new Error('not found'));

    const content = await provider.provideTextDocumentContent({ query: 'missing' } as vscode.Uri);

    expect(content).toContain('Failed to load bean: not found');
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to load bean missing for preview', expect.any(Error));
  });

  it('emits onDidChange when refresh is called', () => {
    const fired: vscode.Uri[] = [];
    provider.onDidChange(uri => fired.push(uri));

    provider.refresh('bean-9');

    expect(fired).toHaveLength(1);
    expect(fired[0].path).toContain('beans-preview:bean-9?bean-9');
    expect(fired[0].scheme).toBe('file');
  });

  it('creates bean preview URI', () => {
    const uri = provider.getBeanPreviewUri('bean-123');

    expect(uri.path).toContain('beans-preview:bean-123?bean-123');
    expect(uri.query).toBe('');
  });

  it('encodes badge text correctly', () => {
    const encoded = (provider as any).encodeForBadge('in-progress_high value');
    expect(encoded).toBe('in--progress__high_value');
  });

  it('returns expected status colors', () => {
    expect((provider as any).getStatusColor('completed')).toBe('success');
    expect((provider as any).getStatusColor('in-progress')).toBe('blue');
    expect((provider as any).getStatusColor('todo')).toBe('lightgrey');
    expect((provider as any).getStatusColor('scrapped')).toBe('red');
    expect((provider as any).getStatusColor('draft')).toBe('yellow');
    expect((provider as any).getStatusColor('unknown')).toBe('lightgrey');
  });

  it('returns expected type colors', () => {
    expect((provider as any).getTypeColor('milestone')).toBe('purple');
    expect((provider as any).getTypeColor('epic')).toBe('blueviolet');
    expect((provider as any).getTypeColor('feature')).toBe('blue');
    expect((provider as any).getTypeColor('bug')).toBe('red');
    expect((provider as any).getTypeColor('task')).toBe('green');
    expect((provider as any).getTypeColor('other')).toBe('lightgrey');
  });

  it('returns expected priority colors', () => {
    expect((provider as any).getPriorityColor('critical')).toBe('critical');
    expect((provider as any).getPriorityColor('high')).toBe('orange');
    expect((provider as any).getPriorityColor('normal')).toBe('blue');
    expect((provider as any).getPriorityColor('low')).toBe('lightgrey');
    expect((provider as any).getPriorityColor('deferred')).toBe('inactive');
    expect((provider as any).getPriorityColor('other')).toBe('lightgrey');
  });

  it('disposes internal event emitter', () => {
    expect(() => provider.dispose()).not.toThrow();
  });
});
