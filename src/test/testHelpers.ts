import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { OutputChannelLike, SpawnProcess } from '../afmtRunner';
import type { BinaryLocator } from '../binaryLocator';
import type { ConfigLocator } from '../configLocator';

export class FakeOutput implements OutputChannelLike {
  public readonly lines: string[] = [];
  public shown = false;

  public append(value: string): void {
    this.lines.push(value);
  }

  public appendLine(value: string): void {
    this.lines.push(value);
  }

  public show(): void {
    this.shown = true;
  }
}

class FakeStdin extends EventEmitter {
  public readonly input: string[] = [];
  public ended = false;
  public throwOnWrite = false;
  public throwOnEnd = false;

  public write(value: string): boolean {
    if (this.throwOnWrite) {
      throw new Error('stdin write failed');
    }
    this.input.push(value);
    return true;
  }

  public end(): void {
    if (this.throwOnEnd) {
      throw new Error('stdin end failed');
    }
    this.ended = true;
  }
}

export class FakeChild extends EventEmitter {
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();
  public readonly stdin = new FakeStdin();
  public killed = false;

  public asChildProcess(): ChildProcessWithoutNullStreams {
    return this as unknown as ChildProcessWithoutNullStreams;
  }

  public kill(): boolean {
    this.killed = true;
    return true;
  }

  public get input(): string[] {
    return this.stdin.input;
  }

  public get ended(): boolean {
    return this.stdin.ended;
  }
}

export function fakeSpawn(child: FakeChild, capture?: { file?: string; args?: readonly string[]; cwd?: string }): SpawnProcess {
  return (file, args, options) => {
    if (capture) {
      capture.file = file;
      capture.args = args;
      capture.cwd = options.cwd;
    }
    return child.asChildProcess();
  };
}

export function runnerLocators(binary: string, configPath?: string): Pick<{ binaryLocator: BinaryLocator; configLocator: ConfigLocator }, 'binaryLocator' | 'configLocator'> {
  return {
    binaryLocator: { resolve: () => binary } as BinaryLocator,
    configLocator: { resolve: () => configPath } as unknown as ConfigLocator,
  };
}
