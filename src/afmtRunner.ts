import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import spawn = require('cross-spawn');
import { stripAnsi } from './ansi';
import { BinaryNotFoundError, BinaryLocator, INSTALL_URL } from './binaryLocator';
import { ConfigLocator } from './configLocator';

export interface OutputChannelLike {
  append(value: string): void;
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
}

export type SpawnProcess = (
  file: string,
  args: readonly string[],
  options: { cwd?: string; env: NodeJS.ProcessEnv },
) => ChildProcessWithoutNullStreams;

export interface AFormattingDocument {
  text: string;
  filePath: string;
  workspaceRoot?: string;
}

export interface AfmtRunnerDeps {
  binaryLocator: BinaryLocator;
  configLocator: ConfigLocator;
  output: OutputChannelLike;
  spawnProcess: SpawnProcess;
  showErrorMessage: (message: string, ...items: string[]) => Thenable<string | undefined>;
  openInstallPage: () => Thenable<void>;
  timeoutMs?: number;
}

export const defaultSpawnProcess: SpawnProcess = (file, args, options) => {
  return spawn(file, [...args], options) as ChildProcessWithoutNullStreams;
};

export async function runAfmt(document: AFormattingDocument, deps: AfmtRunnerDeps): Promise<string | null> {
  let binary: string;
  let configPath: string | undefined;
  try {
    binary = deps.binaryLocator.resolve();
    configPath = deps.configLocator.resolve({
      documentPath: document.filePath,
      workspaceRoot: document.workspaceRoot,
    });
  } catch (error) {
    reportFailureInBackground(error, deps);
    return null;
  }

  const args = ['-', ...(configPath ? ['-c', configPath] : [])];
  deps.output.appendLine(`$ ${binary} ${args.join(' ')}`);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let child: ChildProcessWithoutNullStreams;

    const settleFailure = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(null);
      reportFailureInBackground(error, deps);
    };

    try {
      child = deps.spawnProcess(binary, args, {
        cwd: document.workspaceRoot,
        env: process.env,
      });
    } catch (error) {
      settleFailure(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    timeout = setTimeout(() => {
      child.kill();
      settleFailure(new Error(`afmt did not finish within ${deps.timeoutMs ?? 10_000} ms`));
    }, deps.timeoutMs ?? 10_000);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += decodeChunk(stdoutDecoder, chunk);
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += stripAnsi(decodeChunk(stderrDecoder, chunk));
    });
    child.stdin.on('error', (error) => {
      settleFailure(error instanceof Error ? error : new Error(String(error)));
    });
    child.on('error', (error) => {
      settleFailure(error instanceof Error ? error : new Error(String(error)));
    });
    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      stdout += stdoutDecoder.end();
      stderr += stripAnsi(stderrDecoder.end());
      stderr = nameStdinOrigin(stderr, document.filePath);
      if (code === 0) {
        const warnings = stderr.trim();
        if (warnings) {
          deps.output.appendLine(warnings);
        }
        resolve(stdout);
        return;
      }

      const message = stderr.trim() || `afmt exited with code ${code ?? 'unknown'}`;
      resolve(null);
      reportFailureInBackground(new Error(message), deps);
    });

    try {
      child.stdin.write(document.text);
      child.stdin.end();
    } catch (error) {
      settleFailure(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function decodeChunk(decoder: StringDecoder, chunk: Buffer | string): string {
  return decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}

const STDIN_ORIGIN_PATTERN = /^(Warning: )?<stdin>:/;

/**
 * afmt formats the buffer through `afmt -`, so it has no path to report and
 * emits `<stdin>` as the diagnostic origin. One output channel serves every
 * Apex file in the window, so rewrite the placeholder to the real path before
 * the line reaches the user. Anchored per line: afmt's parse errors echo
 * source snippets, and an unanchored replace would corrupt a message from a
 * file that happens to contain the literal text `<stdin>`.
 */
function nameStdinOrigin(stderr: string, filePath: string): string {
  if (!filePath) {
    return stderr;
  }
  return stderr
    .split('\n')
    .map((line) => line.replace(STDIN_ORIGIN_PATTERN, (_match, prefix: string | undefined) => `${prefix ?? ''}${filePath}:`))
    .join('\n');
}

function reportFailureInBackground(error: unknown, deps: AfmtRunnerDeps): void {
  void reportFailure(error, deps).catch((reportingError: unknown) => {
    const message = reportingError instanceof Error ? reportingError.message : String(reportingError);
    deps.output.appendLine(`[error] Unable to report afmt failure: ${stripAnsi(message)}`);
  });
}

async function reportFailure(error: unknown, deps: AfmtRunnerDeps): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  deps.output.appendLine(`[error] ${stripAnsi(message)}`);

  if (error instanceof BinaryNotFoundError) {
    const choice = await deps.showErrorMessage(`${message} Install instructions: ${INSTALL_URL}`, 'Install afmt');
    if (choice === 'Install afmt') {
      await deps.openInstallPage();
    }
    return;
  }

  const choice = await deps.showErrorMessage(`afmt failed: ${message}`, 'Show Output');
  if (choice === 'Show Output') {
    deps.output.show(true);
  }
}
