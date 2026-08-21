# Agent guidance

This repository is a small VS Code extension that runs `afmt` as the native
Apex formatter. Read the user-facing setup and settings in [README.md](README.md)
before changing extension behavior.

Use the focused project docs for implementation details:

- [Formatter execution and output](docs/formatter-execution.md) covers the
  provider/runner flow, formatting guarantees, warning pass-through, and
  failure reporting.
- [Binary and configuration resolution](docs/binary-and-configuration.md)
  covers `afmt.path`, `afmt.configFile`, lookup order, caching, and workspace
  boundaries.

Keep formatter warnings passive: successful formatting returns afmt's stdout,
and stderr warnings go to the `afmt` output channel without notifications or an
automatic panel reveal. Run `npm run compile` and `npm run test:unit` after
behavior changes; run `npm run lint:md` after Markdown changes.
