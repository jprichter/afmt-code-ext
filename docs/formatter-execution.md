# Formatter execution and output

## Provider flow

`src/extension.ts` creates one `afmt` output channel for the extension
activation and registers both document and range formatting providers for Apex
documents with the `file` scheme. Both providers call the same formatter
function. A range request deliberately formats the complete in-memory
compilation unit because afmt formats whole files; the range is not passed to
afmt as a source fragment.

The formatter runner (`src/afmtRunner.ts`) resolves the binary and optional
configuration before spawning afmt. It invokes:

```text
afmt - [-c <config path>]
```

The document text is written to stdin, the workspace root is the child
process's working directory when one exists, and the command is recorded in the
`afmt` output channel. The extension turns successful stdout into one full-file
`TextEdit`. A failed run returns no edits, so a formatter failure cannot change
the document.

## Warnings and errors

afmt's stderr is decoded as UTF-8 and stripped of ANSI escape sequences. Once
the process closes, each line beginning with either `<stdin>:` or
`Warning: <stdin>:` is rewritten to use the document's absolute `filePath`.
The rewrite is line-anchored, so a later `<stdin>` in a diagnostic message or
source snippet is preserved, and every matching line is rewritten.

For a zero exit code, non-empty stderr is appended verbatim to the `afmt`
output channel. It does not trigger a notification, reveal the panel, or alter
the formatted stdout. This is the warning path used by afmt's unhonored
`afmt:ignore` warning.

For a non-zero exit code, the named stderr becomes the failure message. The
runner writes an `[error]` line to the output channel and shows the existing
error notification; choosing **Show Output** reveals the channel. Spawn,
stdin, timeout, and binary-resolution failures use the same failure-reporting
path. A successful run with empty stderr adds no output beyond its command
line.

The extension intentionally does not convert warnings into VS Code diagnostics
or Problems-panel entries. The output channel is the durable, passive warning
surface for now.
