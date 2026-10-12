# ADR 0001: Phase 0 policy decisions for the JSON-driven build config

- Status: Proposed
- Date: (set on merge)
- Deciders: (TBD)

## Context

`@faims3/build-config` is being introduced as the single source of truth for the
config chain: JSON config → generated `.env` → typed runtime config, replacing
the independent `EnvSchema` parsers in `api/src/buildconfig.ts`,
`app/src/buildconfig.ts` and `web/src/constants.ts`.

The audit of the current implementation against those sources found divergent
coercion behaviour, conflicting defaults, and missing/ambiguous env coverage.
Before any further code changes, this ADR fixes the policy questions that drive
Phase 1/2 implementation.

## Decision

### D1 — Coercion policy: strict-fail, uniformly

Invalid values fail the parse; they do not warn and fall back to a default.

- Applies to all numeric, boolean, enum, URL and list coercion in
  `parseBuildConfig`, `parseGeneratedEnv`, and the env contract.
- Rationale: every value reaching these parsers was produced by the generator
  from validated JSON. A failure therefore indicates a toolchain bug and should
  fail the build rather than silently run with a different limit than intended.
- No end-user behaviour change: the apps keep their existing `configHelpers`
  schemas (warn-and-default) until cutover, so hand-edited local `.env` files
  behave as they do today.

### D2 — Canonical defaults for conflicting keys

| Key / field                                                       | Previous values                                                        | Canonical default                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `branding.appName` (`VITE_APP_NAME`)                              | app `Fieldmark`; web _required_; build-config `FAIMS`                  | `FAIMS`                                                                     |
| `notebookAndRecordUX.notebookName` (`VITE_NOTEBOOK_NAME`)         | app `notebook`; web `project`                                          | `project`                                                                   |
| `maps.mapSource` (`VITE_MAP_SOURCE`)                              | app `osm`; web `osm`; build-config `maptiler`                          | `osm`                                                                       |
| `auth.conductorShortCodePrefix` (`CONDUCTOR_SHORT_CODE_PREFIX`)   | api `FAIMS`; build-config `DEV`                                        | `FAIMS`                                                                     |
| `branding.conductorDescription` (`CONDUCTOR_DESCRIPTION`)         | api `Fieldmark Conductor Server`                                       | `FAIMS Conductor Server`                                                    |
| `couchdb.conductorInternalPort` (`CONDUCTOR_INTERNAL_PORT`)       | api `8000`; env.dist `8080`                                            | `8080`                                                                      |
| `endpoints.appUrl` (`WEB_APP_PUBLIC_URL` for api; `VITE_APP_URL`) | build-config mapped `WEB_APP_PUBLIC_URL` from `endpoints.webUrl` (bug) | `http://localhost:3000` — `WEB_APP_PUBLIC_URL` maps from `endpoints.appUrl` |
| App blank-`VITE_CONDUCTOR_URL` fallback                           | app `http://localhost:8154`; build-config `:8080`                      | `http://localhost:8080`                                                     |

Notes:

- Web's required-ness of `VITE_APP_NAME` / `VITE_WEB_URL` / `VITE_API_URL` /
  `VITE_APP_URL` is dropped: the generator always emits these values, so
  requiring them on the parse side would only add failure surface.
- All other defaults are already aligned between build-config and the
  consuming apps and are unchanged.

### D3 — One boolean vocabulary at the env layer

All boolean-typed env values accept:

- true set: `true`, `1`, `on`, `yes`
- false set: `false`, `0`, `off`, `no`
- case-insensitive; anything else is a parse error (per D1).

This is the superset of every consumer's current behaviour, so no
currently-working value breaks. Specific consequences ratified:

- `VITE_SHOW_RECORD_LINKS`: app currently requires exact `'true'`
  (case-sensitive) → now truthy-vocabulary.
- `VITE_OFFLINE_MAPS`: currently a string compared against `'true'` → real
  boolean (the OSM clamp is a separate shared invariant, see D4).
- `VITE_IGNORE_TOKEN_EXP`: currently `'TRUE'` (case-insensitive exact) →
  real boolean.
- `DISABLE_LOCAL_LOGIN` (api): currently inverted
  (`v.toLowerCase() !== 'true'` when set) → modelled as
  `auth.disableLocalLogin: boolean` in the truthy vocabulary; the API stops
  inverting.
- `VITE_DEVELOPER_MODE` / `DEVELOPER_MODE`: web exact-`'true'` and api
  `truthyBool` respectively → unified vocabulary.

### D4 — Which derived invariants move into the shared schema

Rule of thumb: cross-field _clamping/fallback_ invariants move to the shared
`RuntimeConfig`; pure _string composition_ helpers stay local to their consumer.

**Moves to the shared schema** (computed in `toRuntimeConfig` /
`parseGeneratedEnv` so all consumers agree):

- Long-lived token hints are clamped to `authTokens.maximumLongLivedDurationDays`
  (drop hints above the max; if all are dropped, use `[max]`; dedupe and
  sort). Currently implemented only in web.
- `maps.offlineMaps` is forced to `false` when `maps.mapSource === 'osm'`
  (OSM does not allow bulk download). Currently enforced only in the app.
- `branding.headingAppName` falls back to `branding.appName` when blank.
- `branding.appShortName` falls back to `branding.appName` when blank.
  (Also fixes the round-trip loss where an empty `VITE_APP_SHORT_NAME` came
  back as `''` instead of triggering the fallback.)
- `authTokens.maximumLongLivedDurationDays` accepts
  `unlimited` / `infinite` / `none` (case-insensitive), normalised to the
  canonical no-cap sentinel `'unlimited'` in all parsers (any number means a
  finite cap).
- Bugsnag key: literal `'false'` and blank → `undefined` (app currently treats
  the string `'false'` as "off").

**Stays local** (documented as intentional, not an omission):

- Plural / capitalisation of notebook names (`pluralize`,
  `notebookNamePlural*`) — presentation, one consumer.
- `webHomeUrl`, `signinPath` (`{apiUrl}/login?redirect={webUrl}`),
  `appTokenReturnPath` (`{appUrl}/auth-return`), `maxDesignFileSizeBytes` —
  URL/identifier composition in web.
- `conductorServerId` (`slugify(instanceName)`), `keyFileHost` — api.
- `maptilerApiKey` reuse of `VITE_MAP_SOURCE_KEY` when the dedicated key is
  blank and map source is `maptiler` — app-only behaviour; the two raw keys
  (`maps.autosuggestMapboxKey`, `maps.autosuggestMapTilerKey`) live in the
  shared model, the fallback stays in `app`.
- `appVersion` (`__APP_VERSION__` Vite define) — build-time inject, not env.
- `runningUnderTest` (`JEST_WORKER_ID` / `NODE_ENV`), forced-off export rate
  limiter under test, mock-email forcing — api runtime.
- `KEY_FILE_PATH` existence check with fallback to `.` — api runtime
  (filesystem-dependent, cannot live in a shared parser).
- `FAIMS_COOKIE_SECRET` random-`UUID` fallback when blank — api runtime.
- SMTP fail-fast validation with missing-field report — api runtime.

### D5 — `conductorUrls` is a real list

- JSON: `endpoints.conductorUrls: string[]`.
- Env transport: `VITE_CONDUCTOR_URL` carries a CSV (comma-joined on emit;
  split / trim / filter empties on parse), preserving the app's
  `parseConductorUrls` semantics (including the warning on empty entries).
- `endpoints.apiUrl` remains the single canonical API URL used for
  `VITE_API_URL` / `CONDUCTOR_PUBLIC_URL`. `VITE_CONDUCTOR_URL` is no longer a
  copy of `apiUrl`; it maps to `conductorUrls`.
- Rationale: multi-server login options are an explicitly advertised app
  feature ("One or more conductor URLs separated by comma, each will generate
  a login option") and must remain expressible through the JSON.

### D6 — Remove the `secrets` escape hatch

- `secrets: z.record(...)` is removed from the schema (and from sample
  configs / tests). It currently parses in but is never emitted, making it a
  misleading one-way door.
- Platform-level secrets — `PRIVATE_SIGNING_KEY`, `PUBLIC_SIGNING_KEY`,
  `SOPS_AGE_KEY`, `AWS_DEFAULT_REGION`, `GIT_AUTHORIZATION`, `MATCH_GIT_URL`
  (when derived from GitHub vars) — stay injected by the deployment platform
  or CI, not by the generated env. This is documented in the README.
- If a concrete near-term consumer for a passthrough secret appears, it gets
  an explicit named field with an env-contract mapping rather than an
  untyped record.

## Consequences

- Phase 1 (fix broken validate-coverage, platform aliases, `WEB_APP_PUBLIC_URL`
  mapping, golden round-trip test) and Phase 2 (close the semantics gaps)
  implementations follow directly from these decisions.
- App-side `configHelpers` schemas remain authoritative for hand-edited local
  env until cutover; the strict shared parsers are exercised only on
  generator-produced env.
- Any future divergence between a consumer's coercion and this ADR is a
  defect, not a judgement call.

### D7 — Deduplicate the redundant env keys

The module is the single source of truth for which env keys are generated, so
the two duplicated key spellings are collapsed to one each. The surviving name
is the **mobile** spelling in both cases, which is non-breaking because the not
yet migrated app already reads exactly those names and only the web read the
other spelling (and the web was migrated in the same change):

| Concept     | Dropped key            | Kept key           |
| ----------- | ---------------------- | ------------------ |
| Theme       | `VITE_APP_THEME`       | `VITE_THEME`       |
| Bugsnag key | `VITE_BUGSNAG_API_KEY` | `VITE_BUGSNAG_KEY` |

Additionally, the api's `NEW_CONDUCTOR_URL` (a legacy key carrying the Control
Centre / web URL) is removed entirely. The server receives that URL via
`REDIRECT_WHITELIST`, which it uses for both auth redirects and the browser CORS
allowlist, so no dedicated api key is needed. (`endpoints.webUrl` remains the
canonical field for the web URL; it is populated from `VITE_WEB_URL` for the
web/app platforms.)

## Status

- The D1–D7 policies are implemented, and all three consumers (`app`, `web`,
  `api`) have been migrated to parse their env via this module (see the module
  README "Migration status").
- The redundant env keys are collapsed: `VITE_APP_THEME`/`VITE_BUGSNAG_API_KEY`
  (D7) and the api `NEW_CONDUCTOR_URL` (removed). The remaining `VITE_*` env key
  names are preserved for compatibility; further dedup can be done post-migration
  now that the module owns both ends.
