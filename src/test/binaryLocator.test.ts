import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { BinaryLocator, BinaryNotFoundError } from '../binaryLocator';

function withTempDirectory(run: (directory: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'afmt-extension-'));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('configured afmt.path wins over PATH and is cached', () => {
  withTempDirectory((directory) => {
    const configured = path.join(directory, 'configured-afmt');
    const pathBinary = path.join(directory, 'path-afmt');
    fs.writeFileSync(configured, '');
    fs.writeFileSync(pathBinary, '');
    fs.chmodSync(configured, 0o755);
    fs.chmodSync(pathBinary, 0o755);
    let configuredPath = configured;
    const locator = new BinaryLocator({
      configuredPath: () => configuredPath,
      environment: { PATH: directory },
    });

    assert.equal(locator.resolve(), configured);
    configuredPath = pathBinary;
    assert.equal(locator.resolve(), configured);
    locator.clearCache();
    assert.equal(locator.resolve(), pathBinary);
  });
});

test('falls back to afmt on PATH', () => {
  withTempDirectory((directory) => {
    const pathBinary = path.join(directory, 'afmt');
    fs.writeFileSync(pathBinary, '');
    fs.chmodSync(pathBinary, 0o755);
    const locator = new BinaryLocator({
      configuredPath: () => '',
      environment: { PATH: directory },
    });

    assert.equal(locator.resolve(), pathBinary);
  });
});

test('reports a missing configured binary without silently using PATH', () => {
  const locator = new BinaryLocator({
    configuredPath: () => '/missing/afmt',
    environment: { PATH: '' },
  });

  assert.throws(() => locator.resolve(), BinaryNotFoundError);
});
