# E2E helpers contract

Shared helpers for the WebdriverIO suite. Import from these modules instead of
duplicating env reads, waits, or screenshot logic in specs.

## Modules

| Module          | Role                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `env.ts`        | Load `e2e/.env`, URLs, screenshot mode, `WDIO_LOG_LEVEL`, personas         |
| `auth.ts`       | `loginWeb` / `loginApp` / `loginConductor` / logout                        |
| `wait.ts`       | `waitForUrl`, `waitForTestId`, `waitForGone` (prefer over `browser.pause`) |
| `selectors.ts`  | `byTestId('…')` → `$('[data-testid="…"]')`                                 |
| `screenshot.ts` | `captureStep`, `captureDocs`, `captureRaw`, failure dumps                  |
| `artifacts.ts`  | Run id (`{stamp}-{suite}-{hex}`), dirs, manifest + gallery                 |
| `report.ts`     | Static `index.html` gallery (failure-first) from `manifest.json`           |
| `hooks.ts`      | WDIO hooks wired from conf files                                           |
| `seed.ts`       | Optional API helpers for invites / project ids                             |

## Screenshot modes (`SCREENSHOT_MODE`)

| Value        | Behaviour                             |
| ------------ | ------------------------------------- |
| `off`        | No screenshots                        |
| `docs`       | Docs layout only + failure shots      |
| `artifacts`  | Run artifacts + failure shots         |
| `on` / `all` | Docs + artifacts + failures (default) |

## Artifact layout

```
artifacts/
  index.html              # all runs (newest first)
  <stamp>-<suite>-<hex>/  # e.g. 20260714T053007Z-web-a1b2c3
    index.html            # failure-first gallery + step thumbs
    manifest.jsonl        # append-only during run
    manifest.json         # finalized onComplete (includes suite)
    summary.md
    downloads/            # Chrome download dir for export tests
    <spec>/<test>/001-….png
    failures/<spec>/<test>/{failure.png,page.html,meta.json}
```

Suites: `smoke`, `web`, `app` (set via `beginSuite()` in each WDIO conf).

Open `artifacts/<runId>/index.html` (or regenerate with `pnpm report` from `e2e/`).

## Manifest entry (v1)

See [SUITE.md](../../SUITE.md) for the schema. Each `captureStep` / docs /
failure / result appends one JSON line; `onComplete` writes `manifest.json`.

## Usage sketch

```ts
import {byTestId} from '../helpers/selectors.ts';
import {captureStep} from '../helpers/screenshot.ts';
import {loginWebPersona} from '../helpers/auth.ts';

await loginWebPersona('memberBoth');
await expect(byTestId('web-teams-create-button')).toBeDisplayed();
await captureStep({surface: 'web', label: 'teams-list'});
```
