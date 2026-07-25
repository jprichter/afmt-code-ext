import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ConfigLocatorInput {
  documentPath: string;
  workspaceRoot?: string;
}

export class ConfigLocator {
  public constructor(private readonly configuredPath: () => string | undefined) {}

  public resolve(input: ConfigLocatorInput): string | undefined {
    const explicitPath = this.configuredPath()?.trim();
    if (explicitPath) {
      const base = input.workspaceRoot ?? process.cwd();
      return path.resolve(base, explicitPath);
    }

    const start = path.dirname(path.resolve(input.documentPath));
    const workspaceRoot = input.workspaceRoot ? path.resolve(input.workspaceRoot) : undefined;
    let current = start;

    while (true) {
      const candidate = path.join(current, '.afmt.toml');
      if (fs.existsSync(candidate)) {
        return candidate;
      }

      if (current === workspaceRoot || current === path.parse(current).root) {
        return undefined;
      }
      current = path.dirname(current);
    }
  }
}
