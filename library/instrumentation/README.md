# FAIMS3 Instrumentation

Lightweight performance instrumentation for the FAIMS3 collection app and FAIMS load
testing. Wraps the browser [User Timing API](https://www.w3.org/TR/user-timing/)
(`performance.mark` / `performance.measure`) with a consistent `faims.*` naming
scheme so app code, load-test agents, and Grafana dashboards can share the same
measure names.

Used today in `@faims3/forms` (record save UX timing) and referenced by load-test
agents when reporting metrics. Additional app hooks (survey activation, sync
events, map render, export) are defined in `FAIMS_MEASURES` for future wiring.

## Install

This package is a workspace dependency:

```json
"@faims3/instrumentation": "workspace:*"
```

Build:

```bash
pnpm --filter @faims3/instrumentation build
```

## Quick start

```typescript
import {FAIMS_MEASURES, perf} from '@faims3/instrumentation';

// Point-in-time mark (becomes performance mark "faims.record.save.local")
perf.mark(FAIMS_MEASURES.RECORD_SAVE_LOCAL);

// Duration between two marks (becomes performance measure "faims.record.save.ui")
perf.mark(`${FAIMS_MEASURES.RECORD_SAVE_UI}.start`);
await saveRecord();
perf.mark(`${FAIMS_MEASURES.RECORD_SAVE_UI}.end`);
perf.measure(
  FAIMS_MEASURES.RECORD_SAVE_UI,
  `${FAIMS_MEASURES.RECORD_SAVE_UI}.start`,
  `${FAIMS_MEASURES.RECORD_SAVE_UI}.end`
);

// Wrap an async operation (creates .start / .end or .error marks + a measure)
await perf.wrap('survey.activate.total', async () => {
  perf.mark(FAIMS_MEASURES.SURVEY_ACTIVATE_START);
  await activateSurvey();
  perf.mark(FAIMS_MEASURES.SURVEY_ACTIVATE_SYNC_COMPLETE);
});
```

All marks and measures are prefixed with `faims.` in the Performance Timeline
(see `FAIMS_PREFIX` and `faimsMeasureName()`).

Every mark/measure detail object automatically includes `sessionId` from the
shared `perf` singleton so load tests can correlate events from one browser
session.

## API

| Export | Description |
| --- | --- |
| `perf` | Singleton `FaimsPerf` instance used by app code |
| `FaimsPerf` | Class if you need a separate session scope |
| `FAIMS_MEASURES` | Canonical measure name constants (without `faims.` prefix) |
| `FAIMS_PREFIX` | `'faims'` — prepended to all User Timing entry names |
| `faimsMeasureName(name)` | Returns `faims.${name}` |
| `MeasureDetail` | Shape of detail metadata on marks/measures |
| `PerformanceMeasureEvent` | Shape emitted by the load-test performance bridge |

### `FaimsPerf`

- **`mark(name, detail?)`** — Record a point in time. No-op when `performance.mark`
  is unavailable (SSR, older runtimes).
- **`measure(name, startMark, endMark?, detail?)`** — Record duration between marks.
  Swallows missing-mark errors (e.g. interrupted operations).
- **`wrap(name, fn, detail?)`** — Mark start, run async `fn`, mark end and measure on
  success; on throw, mark `.error` and measure start→error before rethrowing.

### Measure names (`FAIMS_MEASURES`)

Names are grouped by domain. Add new constants here before using them in app code
so agents and dashboards stay aligned.

| Group | Constants | Typical use |
| --- | --- | --- |
| Survey activation | `SURVEY_ACTIVATE_*` | Notebook open / sync bootstrap |
| Record save | `RECORD_SAVE_*` | Form save → local DB → sync complete |
| Sync | `SYNC_*` | Push/pull lifecycle, reconnect, conflicts |
| Map | `MAP_*` | Map and record pin rendering |
| Export | `EXPORT_*` | Export request and download |

See `src/measures.ts` for the full list and inline descriptions.

## Load-test integration

Load-test agents inject a `PerformanceObserver` that watches for measures whose
names start with `faims.` and forwards them to the coordinator as
`performance_measure` metrics (see `load-testing/agents/src/browser-session.ts`).

Agent scenarios import `FAIMS_MEASURES` so reported metric names match app-side
measures even when timing is collected agent-side (e.g. Playwright wall clock for
`record_create` until more app hooks land).

## Where to instrument

**Good candidates:** user-visible latency boundaries — save button → local
persistence, survey activation, export download, map first render.

**Use caution:** high-frequency callbacks such as PouchDB sync `change` handlers.
Marking on every replication event can add overhead and noise; validate impact
before adding instrumentation there.

## Environment behaviour

- **Browser / WebView:** full User Timing support when `performance.mark` exists.
- **Node / tests without `performance`:** all calls are no-ops; safe to import
  without polyfills.
- **Detail payload:** arbitrary JSON-serialisable fields plus auto-injected
  `sessionId`.

## Related docs

- Load testing overview: `load-testing/README.md`
- Grafana dashboards: `load-testing/observability/README.md`
