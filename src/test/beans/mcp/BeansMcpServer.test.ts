import { describe, expect, it } from 'vitest';
import { parseCliArgs, sortBeans } from '../../../beans/mcp/BeansMcpServer';

describe('BeansMcpServer helpers', () => {
  it('parseCliArgs uses defaults when args are missing', () => {
    const parsed = parseCliArgs([]);
    expect(parsed.cliPath).toBe('beans');
    expect(parsed.workspaceRoot.length).toBeGreaterThan(0);
  });

  it('parseCliArgs reads workspace and cli path flags', () => {
    const parsed = parseCliArgs(['--workspace', '/tmp/repo', '--cli-path', '/usr/local/bin/beans']);
    expect(parsed.workspaceRoot).toBe('/tmp/repo');
    expect(parsed.cliPath).toBe('/usr/local/bin/beans');
  });

  it('sortBeans status-priority-type-title mode prioritizes in-progress and critical', () => {
    const sorted = sortBeans(
      [
        { id: 'a', title: 'Zeta', status: 'todo', type: 'task', priority: 'normal' },
        { id: 'b', title: 'Alpha', status: 'in-progress', type: 'bug', priority: 'high' },
        { id: 'c', title: 'Beta', status: 'in-progress', type: 'task', priority: 'critical' },
      ],
      'status-priority-type-title'
    );

    expect(sorted[0]?.id).toBe('c');
    expect(sorted[1]?.id).toBe('b');
    expect(sorted[2]?.id).toBe('a');
  });

  it('sortBeans id mode sorts lexicographically', () => {
    const sorted = sortBeans(
      [
        { id: 'bean-2', title: 'Two', status: 'todo', type: 'task' },
        { id: 'bean-1', title: 'One', status: 'todo', type: 'task' },
      ],
      'id'
    );

    expect(sorted[0]?.id).toBe('bean-1');
    expect(sorted[1]?.id).toBe('bean-2');
  });
});
