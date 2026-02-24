import { describe, expect, it } from 'vitest';

import { isPathWithinRoot, parseCliArgs, sortBeans } from '../../../../src/beans/mcp/BeansMcpServer';

describe('BeansMcpServer utilities', () => {
  it('parses CLI args including port/workspace/cli-path', () => {
    const argv = ['--workspace', '/ws', '--cli-path', '/custom/beans', '--port', '1234'];
    const parsed = parseCliArgs(argv);
    expect(parsed.workspaceRoot).toBe('/ws');
    expect(parsed.cliPath).toBe('/custom/beans');
    expect(parsed.port).toBe(1234);
  });

  it('throws on unsafe cli path', () => {
    expect(() => parseCliArgs(['--cli-path', 'bad;cmd'])).toThrow();
  });

  it('respects env port when set', () => {
    const prev = process.env.BEANS_MCP_PORT;
    try {
      process.env.BEANS_MCP_PORT = '5555';
      const parsed = parseCliArgs([]);
      expect(parsed.port).toBe(5555);
    } finally {
      process.env.BEANS_MCP_PORT = prev;
    }
  });

  it('isPathWithinRoot true/false cases', () => {
    const root = '/tmp/root';
    const inside = '/tmp/root/sub/file';
    const outside = '/tmp/other/file';
    expect(isPathWithinRoot(root, inside)).toBe(true);
    expect(isPathWithinRoot(root, outside)).toBe(false);
  });

  it('sorts beans by id', () => {
    const beans = [
      { id: 'z', title: 'Z', status: 'todo', type: 'task', priority: 'normal' },
      { id: 'a', title: 'A', status: 'in-progress', type: 'feature', priority: 'critical' },
    ];
    const sorted = sortBeans(beans as any, 'id');
    expect(sorted[0].id).toBe('a');
  });
});
