import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { ConfigLocator } from '../configLocator';

function withTempDirectory(run: (directory: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'afmt-config-'));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('explicit config is resolved relative to the workspace', () => {
  const locator = new ConfigLocator(() => 'config/project.toml');
  assert.equal(locator.resolve({
    documentPath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }), '/workspace/config/project.toml');
});

test('finds the nearest config while walking toward the workspace root', () => {
  withTempDirectory((directory) => {
    const nested = path.join(directory, 'force-app', 'main', 'default', 'classes');
    fs.mkdirSync(nested, { recursive: true });
    const rootConfig = path.join(directory, '.afmt.toml');
    const nearestConfig = path.join(directory, 'force-app', '.afmt.toml');
    fs.writeFileSync(rootConfig, '');
    fs.writeFileSync(nearestConfig, '');
    const locator = new ConfigLocator(() => '');

    assert.equal(locator.resolve({
      documentPath: path.join(nested, 'Example.cls'),
      workspaceRoot: directory,
    }), nearestConfig);
  });
});

test('returns undefined when no config exists', () => {
  withTempDirectory((directory) => {
    const locator = new ConfigLocator(() => '');
    assert.equal(locator.resolve({
      documentPath: path.join(directory, 'classes', 'Example.cls'),
      workspaceRoot: directory,
    }), undefined);
  });
});
