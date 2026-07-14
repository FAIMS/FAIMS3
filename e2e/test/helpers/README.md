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
| `artifacts.ts`  | Run id, dirs, JSONL → `manifest.json` + `summary.md`                       |
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
artifacts/<runId>/
  manifest.jsonl          # append-only during run
  manifest.json           # finalized onComplete
  summary.md
  downloads/              # Chrome download dir for export tests
  <spec>/<test>/001-….png
  failures/<spec>/<test>/{failure.png,page.html,meta.json}
```

## Manifest entry (v1)

See `HANDOFF_E2E_SUITE.md` §3. Each `captureStep` / docs / failure / result
appends one JSON line; `onComplete` writes `manifest.json`.

## Usage sketch

```ts
import {byTestId} from '../helpers/selectors.ts';
import {captureStep} from '../helpers/screenshot.ts';
import {loginWebPersona} from '../helpers/auth.ts';

await loginWebPersona('memberBoth');
await expect(byTestId('web-teams-create-button')).toBeDisplayed();
await captureStep({surface: 'web', workflowId: 'T2', label: 'teams-list'});
```
