import * as assert from 'assert';
import { parseCliArgs, sortBeans } from '../../../beans/mcp/BeansMcpServer';

suite('BeansMcpServer helpers', () => {
  test('parseCliArgs uses defaults when args are missing', () => {
    const parsed = parseCliArgs([]);
    assert.strictEqual(parsed.cliPath, 'beans');
    assert.ok(parsed.workspaceRoot.length > 0);
  });

  test('parseCliArgs reads workspace and cli path flags', () => {
    const parsed = parseCliArgs(['--workspace', '/tmp/repo', '--cli-path', '/usr/local/bin/beans']);
    assert.strictEqual(parsed.workspaceRoot, '/tmp/repo');
    assert.strictEqual(parsed.cliPath, '/usr/local/bin/beans');
  });

  test('sortBeans status-priority-type-title mode prioritizes in-progress and critical', () => {
    const sorted = sortBeans(
      [
        { id: 'a', title: 'Zeta', status: 'todo', type: 'task', priority: 'normal' },
        { id: 'b', title: 'Alpha', status: 'in-progress', type: 'bug', priority: 'high' },
        { id: 'c', title: 'Beta', status: 'in-progress', type: 'task', priority: 'critical' }
      ],
      'status-priority-type-title'
    );

    assert.strictEqual(sorted[0]?.id, 'c');
    assert.strictEqual(sorted[1]?.id, 'b');
    assert.strictEqual(sorted[2]?.id, 'a');
  });

  test('sortBeans id mode sorts lexicographically', () => {
    const sorted = sortBeans(
      [
        { id: 'bean-2', title: 'Two', status: 'todo', type: 'task' },
        { id: 'bean-1', title: 'One', status: 'todo', type: 'task' }
      ],
      'id'
    );

    assert.strictEqual(sorted[0]?.id, 'bean-1');
    assert.strictEqual(sorted[1]?.id, 'bean-2');
  });
});
