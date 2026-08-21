# afmt Formatter for VS Code

This extension registers [afmt](https://github.com/xixiaofinland/afmt) as the
native formatter for Apex files. It formats the in-memory editor buffer by
running `afmt -`, so unsaved edits are supported and a formatter failure never
changes the document.

## Install

1. Install afmt using the [afmt installation instructions](https://github.com/xixiaofinland/afmt#-installation).
2. Install this extension from a VSIX or the VS Code Marketplace.
3. Select **afmt Formatter** as the default formatter for Apex:

   ```json
   {
     "[apex]": {
       "editor.defaultFormatter": "jprichter.afmt-code-ext",
       "editor.formatOnSave": true
     }
   }
   ```

The extension reuses the `apex` language id from the Salesforce Extension Pack.
It also contributes a minimal fallback for `.cls`, `.trigger`, `.apex`, and
`.apexc` files when that pack is not installed.

## Settings

- `afmt.path`: an explicit path to the afmt binary. Empty searches `PATH`.
- `afmt.configFile`: an explicit `.afmt.toml` path. Relative paths resolve from
  the workspace root. Empty discovers the nearest `.afmt.toml` above the file.
- `afmt.enable`: master toggle for the formatter; defaults to `true`.

Format Selection runs afmt against the complete Apex compilation unit because
afmt formats whole files. The selected range is therefore not passed as a
partial source fragment.

Warnings from afmt appear in the **afmt** output channel (**View → Output →
afmt**). They name the document path instead of afmt's `<stdin>` placeholder
and do not block formatting.

## Development

```sh
npm install
npm run compile
npm run test:unit
npm run package:vsix
```

The extension host tests use `@vscode/test-cli`; the unit tests exercise the
formatter runner and filesystem resolution without requiring a real afmt
binary.
