# Binary and configuration resolution

## `afmt.path`

`BinaryLocator` resolves the configured `afmt.path` first. The value is
trimmed, supports home-directory and environment-variable expansion, and must
identify an executable file. A configured path that is missing or not
executable is an error; the locator does not silently fall back to `PATH` in
that case.

When `afmt.path` is empty, the locator searches `PATH` for `afmt` (including
the platform's executable extensions on Windows). A successful resolution is
cached for subsequent format requests. Changing `afmt.path` clears that cache
through the configuration-change listener in `src/extension.ts`.

Binary lookup failures are reported through the runner's existing error path,
which writes to the `afmt` output channel and offers the afmt installation page.

## `afmt.configFile`

When set, `afmt.configFile` is resolved relative to the workspace root, or to
the extension process's current working directory when no workspace is open.
The resulting path is passed to afmt with `-c`.

When empty, `ConfigLocator` starts in the document's containing directory and
walks upward for the nearest `.afmt.toml`. With a workspace open, the search
stops at that workspace root; without one, it continues to the filesystem
root. No config argument is passed when no file is found.

## Enablement and workspace context

`afmt.enable` is the master formatter toggle and defaults to `true`. When it is
`false`, both formatting providers return no edits without invoking afmt.

The document path comes from the VS Code file URI and is always supplied to the
runner for file-backed Apex documents. The workspace root is optional, which
allows loose files outside an open workspace to use the same formatter and
configuration rules.
