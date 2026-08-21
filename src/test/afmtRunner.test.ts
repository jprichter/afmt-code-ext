import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeChild, FakeOutput, fakeSpawn, runnerLocators } from './testHelpers';
import { runAfmt } from '../afmtRunner';

test('runs afmt with stdin and the discovered config, returning stdout', async () => {
  const child = new FakeChild();
  const capture: { file?: string; args?: readonly string[]; cwd?: string } = {};
  const output = new FakeOutput();
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt', '/workspace/.afmt.toml'),
    output,
    spawnProcess: fakeSpawn(child, capture),
    showErrorMessage: async () => undefined,
    openInstallPage: async () => undefined,
  });

  child.stdout.emit('data', 'class Example {\n}\n');
  child.emit('close', 0);

  assert.equal(await resultPromise, 'class Example {\n}\n');
  assert.equal(capture.file, '/tools/afmt');
  assert.deepEqual(capture.args, ['-', '-c', '/workspace/.afmt.toml']);
  assert.equal(capture.cwd, '/workspace');
  assert.deepEqual(child.input, ['class Example{}']);
  assert.equal(child.ended, true);
});

test('preserves UTF-8 characters split across stdout chunks', async () => {
  const child = new FakeChild();
  const resultPromise = runAfmt({
    text: '// café 😀',
    filePath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output: new FakeOutput(),
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async () => undefined,
    openInstallPage: async () => undefined,
  });
  const output = Buffer.from('// café 😀');
  const emojiStart = output.indexOf(Buffer.from('😀'));

  child.stdout.emit('data', output.subarray(0, emojiStart + 1));
  child.stdout.emit('data', output.subarray(emojiStart + 1));
  child.emit('close', 0);

  assert.equal(await resultPromise, '// café 😀');
});

test('passes successful warnings through without changing the formatted result', async () => {
  const child = new FakeChild();
  const output = new FakeOutput();
  const messages: string[] = [];
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output,
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async (message) => {
      messages.push(message);
      return undefined;
    },
    openInstallPage: async () => undefined,
  });

  child.stderr.emit('data', 'Warning: <stdin>:2:3: afmt:ignore could not be applied; directive was preserved');
  child.stdout.emit('data', 'class Example {\n}\n');
  child.emit('close', 0);

  assert.equal(await resultPromise, 'class Example {\n}\n');
  assert.equal(output.lines[1], 'Warning: /workspace/classes/Example.cls:2:3: afmt:ignore could not be applied; directive was preserved');
  assert.equal(messages.length, 0);
  assert.equal(output.shown, false);
});

test('does not append a channel line when successful afmt output has no stderr', async () => {
  const child = new FakeChild();
  const output = new FakeOutput();
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
  }, {
    ...runnerLocators('/tools/afmt'),
    output,
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async () => undefined,
    openInstallPage: async () => undefined,
  });

  child.emit('close', 0);

  assert.equal(await resultPromise, '');
  assert.deepEqual(output.lines, ['$ /tools/afmt -']);
});

test('rewrites every anchored warning origin but preserves message bodies', async () => {
  const child = new FakeChild();
  const output = new FakeOutput();
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
  }, {
    ...runnerLocators('/tools/afmt'),
    output,
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async () => undefined,
    openInstallPage: async () => undefined,
  });

  child.stderr.emit('data', [
    'Warning: <stdin>:2:3: first warning',
    'Warning: <stdin>:4:1: unexpected token near <stdin>',
  ].join('\n'));
  child.emit('close', 0);

  assert.equal(await resultPromise, '');
  assert.equal(output.lines[1], [
    'Warning: /workspace/classes/Example.cls:2:3: first warning',
    'Warning: /workspace/classes/Example.cls:4:1: unexpected token near <stdin>',
  ].join('\n'));
});

test('rewrites a warning origin split across stderr chunks after decoding', async () => {
  const child = new FakeChild();
  const output = new FakeOutput();
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
  }, {
    ...runnerLocators('/tools/afmt'),
    output,
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async () => undefined,
    openInstallPage: async () => undefined,
  });

  child.stderr.emit('data', 'Warning: <std');
  child.stderr.emit('data', 'in>:2:3: split warning');
  child.emit('close', 0);

  assert.equal(await resultPromise, '');
  assert.equal(output.lines[1], 'Warning: /workspace/classes/Example.cls:2:3: split warning');
});

test('returns null and shows output when afmt exits unsuccessfully', async () => {
  const child = new FakeChild();
  const output = new FakeOutput();
  const messages: string[] = [];
  const resultPromise = runAfmt({
    text: 'class Broken {',
    filePath: '/workspace/classes/Broken.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output,
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async (message) => {
      messages.push(message);
      return 'Show Output';
    },
    openInstallPage: async () => undefined,
  });

  child.stderr.emit('data', '\u001b[31m<stdin>:1:1: parse error\u001b[0m');
  child.emit('close', 1);

  assert.equal(await resultPromise, null);
  assert.match(messages[0] ?? '', /\/workspace\/classes\/Broken\.cls:1:1: parse error/);
  assert.doesNotMatch(messages[0] ?? '', /<stdin>/);
  assert.match(output.lines[1] ?? '', /\/workspace\/classes\/Broken\.cls:1:1: parse error/);
  assert.equal(output.shown, true);
});

test('settles before an unresolved error notification is acted on', async () => {
  const child = new FakeChild();
  const resultPromise = runAfmt({
    text: 'class Broken {',
    filePath: '/workspace/classes/Broken.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output: new FakeOutput(),
    spawnProcess: fakeSpawn(child),
    showErrorMessage: () => new Promise<string | undefined>(() => {}),
    openInstallPage: async () => undefined,
  });

  child.stderr.emit('data', 'parse error');
  child.emit('close', 1);

  const result = await Promise.race([
    resultPromise,
    new Promise<'timed out'>((resolve) => setTimeout(() => resolve('timed out'), 50)),
  ]);
  assert.equal(result, null);
});

test('returns null when writing to stdin throws synchronously', async () => {
  const child = new FakeChild();
  child.stdin.throwOnWrite = true;
  const messages: string[] = [];
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output: new FakeOutput(),
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async (message) => {
      messages.push(message);
      return undefined;
    },
    openInstallPage: async () => undefined,
  });

  assert.equal(await resultPromise, null);
  assert.match(messages[0] ?? '', /stdin write failed/);
});

test('returns null when stdin emits an error', async () => {
  const child = new FakeChild();
  const messages: string[] = [];
  const resultPromise = runAfmt({
    text: 'class Example{}',
    filePath: '/workspace/classes/Example.cls',
    workspaceRoot: '/workspace',
  }, {
    ...runnerLocators('/tools/afmt'),
    output: new FakeOutput(),
    spawnProcess: fakeSpawn(child),
    showErrorMessage: async (message) => {
      messages.push(message);
      return undefined;
    },
    openInstallPage: async () => undefined,
  });

  child.stdin.emit('error', new Error('stdin stream failed'));

  assert.equal(await resultPromise, null);
  assert.match(messages[0] ?? '', /stdin stream failed/);
});
