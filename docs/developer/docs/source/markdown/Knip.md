# Knip — unused code & dependency analysis

[Knip](https://knip.dev) finds **unused files, exports, dependencies and
duplicate exports** across the FAIMS3 monorepo. It complements `oxlint`
(per-file linting) and `oxfmt` (formatting) by looking at the project as a
whole: it follows the import graph from a set of declared entry points and
reports anything it cannot reach.

This document describes how Knip is wired up in this repository, how to run it,
and how to interpret its output.

## Installation

Knip is already a dev dependency of the root workspace and does not need to be
installed separately — a normal `pnpm install` at the repo root provides it.

- Declared in the root [`package.json`](../../../../../package.json) under
  `devDependencies` as `knip`.
- A `knip` script is defined at the repo root.
- Configuration lives in [`knip.json`](../../../../../knip.json) at the repo
  root.

## Running Knip

All commands are run from the **repository root**.

```bash
# Full report across all workspaces
pnpm knip

# Equivalent (uses the root "knip" script)
pnpm run knip
```

Knip exits with a **non-zero status code when it finds issues**, which makes it
usable as a CI gate.

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

# Show why a workspace resolves the files/deps it does (debugging the config)
pnpm knip --workspace <name> --debug
```

The categories Knip reports are: `files`, `dependencies`, `devDependencies`,
`optionalPeerDependencies`, `unlisted`, `binaries`, `unresolved`, `exports`,
`nsExports`, `types`, `nsTypes`, `enumMembers`, `duplicates`.

## How the configuration works

`knip.json` uses Knip's [monorepo / workspaces](https://knip.dev/features/monorepos-and-workspaces)
mode and declares **every** pnpm workspace explicitly. Each entry under
`workspaces` declares:

- `entry` — the files Knip treats as roots of the import graph (anything not
  reachable from an entry is reported as unused).
- `project` — the set of source files in that workspace that Knip is allowed to
  consider when looking for unused files/exports.

The workspaces and their entry points:

| Workspace                | Entry                                                                        | Notes                                                 |
| ------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `api`                    | `src/index.ts`, `src/scripts/*.ts`                                           | Express server + ts-node CLIs; Mocha tests via plugin |
| `app`                    | `src/index.tsx`                                                              | Vite/Vitest + Capacitor                               |
| `web`                    | `src/main.tsx`                                                               | Vite/Vitest + TanStack Router (`routeTree.gen.ts`)    |
| `library/forms`          | `lib/index.ts`, `src/main.tsx`                                               | Published lib (`lib/`) + dev harness (`src/`)         |
| `library/data-model`     | `src/index.ts`                                                               | Jest tests via plugin                                 |
| `infrastructure/aws-cdk` | `bin/aws-cdk-faims-infra.ts`, `validateConfig.ts`                            | Code lives in `lib/`/`bin/`, not `src/`               |
| `e2e` (`@faims3/e2e`)    | `wdio*.conf.ts`, `test/specs/**/*.e2e.ts`, `chrome-headless-capabilities.ts` | WebdriverIO + Appium                                  |

Knip auto-detects and runs **tool plugins** based on each workspace's
dependencies and config files (Vite, Vitest, Jest, Mocha, WebdriverIO,
Capacitor, MSW, ts-node, Oxlint). These contribute extra entry points (for
example Vitest `setupFiles`, Mocha specs from `.mocharc.json`, and the
WebdriverIO config) so that test-only dependencies are correctly seen as used.

The config also sets:

- `ignoreExportsUsedInFile` for `interface` and `type` — an export only used
  within the file that declares it is not reported.
- `tags: ["-lintignore"]` — any symbol annotated with a `@lintignore` JSDoc tag
  is excluded from the report. Use this to deliberately suppress a finding in
  source:

  ```ts
  /** @lintignore intentionally part of the public API */
  export const keepMe = ...;
  ```

- `ignoreBinaries: ["run-script"]` — suppresses a false positive: `pnpm
run-script ...` is a built-in pnpm subcommand, not an external binary.
- Per-workspace `ignoreDependencies` for packages that are **resolved at
  runtime by a toolchain** and can never be seen by static analysis:
  - `app`: `@capacitor/android`, `@capacitor/ios` — native platform packages,
    consumed by the native build, never imported in TS.
  - `e2e`: `@wdio/local-runner`, `@wdio/appium-service`, `appium`,
    `appium-uiautomator2-driver`, `chromedriver`, `ts-node` — loaded by the
    WebdriverIO runner / Appium at runtime via config strings.

## A note on the `api` workspace and `.gitignore`

Knip honours `.gitignore` files when building its `project` file list. A
malformed pattern in `api/.gitignore` (`*data_dummy_listing||*`) was previously
parsed by Knip's glob engine as an empty alternation (`||`) that matched
**everything**, so the entire `api/src` tree was excluded and _every_ api
dependency was falsely reported as unused. Git itself treats the `|` characters
literally, so the bug was invisible outside of Knip. The pattern has been
corrected to `*data_dummy_listing*` (its evident intent), which both fixes Knip
and makes the ignore rule actually work in git. If you add patterns to a
`.gitignore`, avoid `|` characters — they are not valid glob/gitignore syntax.

## Interpreting the output

With the corrected configuration, the remaining findings are **genuine** and
worth reviewing — they are no longer configuration artefacts. As of writing, a
`pnpm knip` run reports roughly:

| Category                    | Count | What to do                                                    |
| --------------------------- | ----- | ------------------------------------------------------------- |
| Unused files                | ~18   | Verify, then delete (e.g. orphaned themes, `._test` files)    |
| Unused dependencies         | ~51   | Verify each, then remove from the relevant `package.json`     |
| Unused devDependencies      | ~28   | As above                                                      |
| Unlisted dependencies       | ~10   | Add the package to the correct `package.json`                 |
| Unlisted binaries           | ~3    | Declare the providing package, or ignore if external (CI)     |
| Unresolved imports          | ~2    | Fix the import / install or remove the referenced types       |
| Unused exports              | ~236  | Verify, then remove the `export` keyword or the symbol        |
| Unused exported types/enums | ~11   | As above                                                      |
| Duplicate exports           | ~42   | Mostly intentional back-compat aliases — see below            |
| Configuration hints         | ~1    | Root `package.json` `main: index.js` points at a missing file |

Counts will drift as the codebase changes.

### Things that are intentional / expected

- **Duplicate exports** are mostly deliberate backward-compatibility aliases,
  e.g. the versioned schema aliases in
  `library/data-model/src/data_storage/.../types.ts`
  (`AuthRecordV5FieldsSchema` ↔ `AuthRecordFieldsSchema`) and components that
  export both a named symbol and a `default`. Exclude them with
  `--exclude duplicates`, or annotate with `@lintignore` if a clean report is
  wanted.
- **Disabled tests** named `*._test.tsx` (rather than `*.test.tsx`) are not run
  by Vitest and therefore show up as unused files. They are orphaned test files,
  not dead production code — decide whether to re-enable or delete them.

### Common reasons for a finding that is _not_ dead code

Before deleting anything, check for these (they are the usual false-positive
sources, and the ones that remain are why every finding needs a quick manual
check):

- symbols referenced only by string (routes, dynamic lookups);
- dependencies pulled in only via build config / polyfills (e.g.
  `rollup-plugin-node-polyfills` referenced as a string alias in
  `vite.config.ts`, or `buffer`/`stream` global polyfills);
- public API surface intentionally exported for downstream consumers.

If something is genuinely used but undetectable, prefer a targeted fix —
`@lintignore` on the symbol, or `ignoreDependencies` in `knip.json` — over
deleting it.

## Suggested workflow

1. Run `pnpm knip` from the repo root.
2. Triage one category/workspace at a time:
   `pnpm knip --workspace <name> --include <category>`.
3. Verify each finding (see the false-positive sources above) before removing
   code or dependencies.
4. Use `@lintignore` / `knip.json` ignore options for intentional public API or
   runtime-only usage rather than deleting it.

## References

- Knip documentation: <https://knip.dev>
- Configuration reference: <https://knip.dev/reference/configuration>
- Handling issues / false positives: <https://knip.dev/guides/handling-issues>
