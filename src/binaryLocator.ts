import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const INSTALL_URL = 'https://github.com/xixiaofinland/afmt#-installation';

export class BinaryNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'BinaryNotFoundError';
  }
}

export interface BinaryLocatorOptions {
  configuredPath: () => string | undefined;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

export class BinaryLocator {
  private cachedPath: string | undefined;

  public constructor(private readonly options: BinaryLocatorOptions) {}

  public resolve(): string {
    if (this.cachedPath) {
      return this.cachedPath;
    }

    const configuredPath = this.options.configuredPath()?.trim();
    if (configuredPath) {
      const expandedPath = expandPath(configuredPath, this.options.environment ?? process.env);
      if (isExecutableFile(expandedPath, this.options.platform ?? process.platform)) {
        this.cachedPath = expandedPath;
        return expandedPath;
      }

      throw new BinaryNotFoundError(`The configured afmt binary was not found or is not executable: ${expandedPath}`);
    }

    const pathBinary = findOnPath('afmt', this.options.environment ?? process.env, this.options.platform ?? process.platform);
    if (pathBinary) {
      this.cachedPath = pathBinary;
      return pathBinary;
    }

    throw new BinaryNotFoundError('afmt was not found on PATH. Install afmt or set afmt.path.');
  }

  public clearCache(): void {
    this.cachedPath = undefined;
  }
}

export function expandPath(value: string, environment: NodeJS.ProcessEnv): string {
  const home = environment.HOME ?? environment.USERPROFILE ?? os.homedir();
  const withHome = value.replace(/^~(?=$|[\\/])/, home);
  return withHome.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)|%([^%]+)%/g, (match, braced, bare, windows) => {
    const variable = braced ?? bare ?? windows;
    return environment[variable] ?? match;
  });
}

function findOnPath(command: string, environment: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | undefined {
  const pathEntries = (environment.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extensions = platform === 'win32'
    ? (environment.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      if (isExecutableFile(candidate, platform)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function isExecutableFile(candidate: string, platform: NodeJS.Platform): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) {
      return false;
    }
    if (platform === 'win32') {
      return true;
    }
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
