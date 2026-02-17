#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node ./scripts/release.js <version>');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const releaseScript = path.join(repoRoot, 'scripts', 'release.sh');

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number') {
    process.exit(result.status);
  }

  console.error(result.error ? String(result.error) : `Failed to execute ${cmd}`);
  process.exit(1);
};

if (process.platform === 'win32') {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    'bash',
  ];

  const selected = candidates.find((candidate) => {
    if (candidate === 'bash') {
      return true;
    }
    return fs.existsSync(candidate);
  });

  run(selected, [releaseScript, version]);
} else {
  run('bash', [releaseScript, version]);
}
