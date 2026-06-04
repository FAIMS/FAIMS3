# Knip — unused code & dependency analysis

[Knip](https://knip.dev) finds **unused files, exports, dependencies and
duplicate exports** across the FAIMS3 monorepo. It complements `oxlint`
(per-file linting) and `oxfmt` (formatting) by looking at the project as a
whole: it follows the import graph from a set of declared entry points and
reports anything it cannot reach.

This document describes how Knip is wired up in this repository, how to run it,
how to read its output, and — importantly — the **known false positives** in the
current configuration so that results are interpreted correctly.

> **Status (sanity check only):** Knip is installed and runnable, but the
> configuration in `knip.json` does not yet cover every workspace. A large share
> of the current findings are configuration artefacts rather than genuine dead
> code. See [Interpreting the current output](#interpreting-the-current-output)
> before acting on anything Knip reports. No code or dependencies have been
> removed on the basis of this report.

## Installation

Knip is already a dev dependency of the root workspace and does not need to be
installed separately — a normal `pnpm install` at the repo root provides it.

- Declared in the root [`package.json`](../../../../../package.json) under
  `devDependencies` as `knip` (currently `^5.75.x`).
- A `knip` script is defined at the repo root.
- Configuration lives in [`knip.json`](../../../../../knip.json) at the repo
  root.

## Running Knip

All commands are run from the **repository root**.

```bash
# Full report across all configured workspaces
pnpm knip

# Equivalent (uses the root "knip" script)
pnpm run knip
```

Knip exits with a **non-zero status code when it finds issues**, which is what
makes it usable as a CI gate.

### Useful flags

```bash
# Limit the run to a single workspace (folder name as in pnpm-workspace.yaml)
pnpm knip --workspace api

# Only report a single category (handy when triaging one problem at a time)
pnpm knip --include dependencies
pnpm knip --include files
pnpm knip --include exports,types

# Exclude noisy categories
pnpm knip --exclude duplicates

# Treat the run as production-only (ignores test files / devDependencies)
pnpm knip --production

# Machine-readable output
pnpm knip --reporter json
pnpm knip --reporter compact
```

The categories Knip reports are: `files`, `dependencies`, `devDependencies`,
`optionalPeerDependencies`, `unlisted`, `binaries`, `unresolved`, `exports`,
`nsExports`, `types`, `nsTypes`, `enumMembers`, `duplicates`.

## How the configuration works

`knip.json` uses Knip's [monorepo / workspaces](https://knip.dev/features/monorepos-and-workspaces)
mode. Each entry under `workspaces` declares:

- `entry` — the files Knip treats as roots of the import graph (anything not
  reachable from an entry is "unused").
- `project` — the set of source files in that workspace that Knip is allowed to
  consider.

The current config also sets:

- `ignoreExportsUsedInFile` for `interface` and `type` — an export that is only
  used within the file that declares it is not reported. This avoids noise from
  types that are exported for documentation/consistency but consumed locally.
- `tags: ["-lintignore"]` — any symbol annotated with a `@lintignore` JSDoc tag
  is excluded from the report. Use this to deliberately suppress a finding in
  source, e.g.:

  ```ts
  /** @lintignore intentionally part of the public API */
  export const keepMe = ...;
  ```

## Interpreting the current output

A sanity-check run (`pnpm knip`) currently reports roughly:

| Category                    | Count | Verdict                                              |
| --------------------------- | ----- | ---------------------------------------------------- |
| Unused files                | ~33   | Mixed — mostly real, some config-driven (e2e)        |
| Unused dependencies         | ~84   | **Largely false positives** (see `api` below)        |
| Unused devDependencies      | ~58   | **Largely false positives** (see `api` below)        |
| Unlisted dependencies       | ~4    | Real — should be declared in the right `package.json`|
| Unlisted binaries           | ~4    | Mostly real / expected                               |
| Unused exports              | ~183  | Needs manual review — plausible but verify           |
| Unused exported types       | ~2    | Needs manual review                                  |
| Unused exported enum members| ~1    | Needs manual review                                  |
| Duplicate exports           | ~40   | **Mostly intentional** (back-compat aliases)         |
| Configuration hints         | ~6    | Action items for `knip.json` itself                  |

The counts will drift as the codebase changes; the **shape** of the findings is
the important part.

### Known config gaps that cause false positives

These are problems with the Knip configuration, not the code. They should be
fixed in `knip.json` (and `pnpm-workspace.yaml`) **before** anyone acts on the
related findings.

1. **The `api` workspace is not configured.**
   `pnpm-workspace.yaml` includes `api`, but `knip.json` has no `api` entry.
   As a result Knip cannot follow the api import graph properly and reports the
   bulk of the api runtime/dev dependencies as "unused". This is demonstrably
   wrong — for example `express`, `cors`, `passport`, `morgan`, `cookie-session`
   and `handlebars` are all imported at the top of
   [`api/src/expressSetup.ts`](../../../../../api/src/expressSetup.ts) yet appear
   in the "Unused dependencies" list. **Treat every `api/package.json` entry in
   the dependency report as suspect until `api` is configured** with proper
   entry points (server entry `src/index.ts`, the `src/scripts/*.ts` CLIs, and
   the Mocha test suite).

2. **`infrastructure/aws-cdk` project pattern matches nothing.**
   The config points `project` at `src/**`, but the CDK code actually lives in
   `infrastructure/aws-cdk/lib/` (with the entry in `bin/`). Knip emits a
   `Refine project pattern (no matches)` configuration hint for this workspace.
   The `project` glob should target `lib/**` and `bin/**`.

3. **`e2e` has no entry configuration.**
   `e2e` is picked up as a workspace with Knip defaults, so the WebdriverIO
   config files (`wdio*.conf.ts`) and page objects/specs are reported as unused
   files. They are not dead code — they need to be declared as entry points
   (e.g. `wdio*.conf.ts` and `test/specs/**/*.e2e.ts`).

4. **Stale workspaces in `pnpm-workspace.yaml`.**
   `pnpm-workspace.yaml` still lists `designer` and `tests` packages, but those
   directories no longer exist on disk (the designer now lives under
   `web/src/designer`). These stale entries should be removed; they are a
   separate cleanup from Knip but surface while auditing workspaces.

### Categories that are mostly intentional

- **Duplicate exports** — the majority are deliberate backward-compatibility
  aliases, e.g. the versioned schema aliases in
  `library/data-model/src/data_storage/.../types.ts`
  (`AuthRecordV5FieldsSchema` ↔ `AuthRecordFieldsSchema`), and components that
  export both a named symbol and a `default` (`QRCodeButton|default`). These are
  generally safe and may be excluded with `--exclude duplicates` or annotated
  with `@lintignore` if a clean report is desired.

### Categories that warrant real review

- **Unused files / unused exports** in the configured workspaces (`app`, `web`,
  `library/forms`, `library/data-model`) are plausible dead code, but each needs
  to be verified manually before removal. Common reasons for false positives
  here are:
  - symbols referenced only by string (routes, dynamic lookups);
  - test-only helpers where the test files are not declared as entries;
  - public API surface that is intentionally exported for downstream consumers.

- **Unlisted dependencies** (e.g. `@wdio/types`, `jsdom`, `@vitest/coverage-v8`,
  `react-scripts`) are genuine: the package is imported/used but missing from the
  relevant `package.json`. These are low-risk, useful fixes.

## Suggested workflow

1. Run `pnpm knip` from the repo root.
2. Ignore the `api` dependency findings and the `aws-cdk`/`e2e` file findings
   until the config gaps above are addressed.
3. For everything else, verify each finding before deleting code — prefer
   `pnpm knip --workspace <name> --include <category>` to focus.
4. Use the `@lintignore` tag (or `knip.json` ignore options) for intentional
   public API / aliases rather than deleting them.

## References

- Knip documentation: <https://knip.dev>
- Configuration reference: <https://knip.dev/reference/configuration>
- Handling issues / false positives: <https://knip.dev/guides/handling-issues>
