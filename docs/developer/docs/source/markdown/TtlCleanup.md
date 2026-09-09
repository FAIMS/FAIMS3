# TTL cleanup of ephemeral CouchDB documents

Ephemeral auth and invite documents expire in application logic, but CouchDB
does not purge them automatically. Conductor provides a **one-shot CLI** that
deletes eligible docs after retention windows that preserve auth rate-limiting.

We don't currently utilise the CouchDB \_purge mechanism. Compacting deleted
records will leave very minimal data, and it is not currently seen as
worthwhile purging documents.

## What is cleaned

Docs are not deleted the instant they expire. Each type is kept for a short
extra window so in-flight auth and rate-limiting still work, then removed.

| Doc type       | DB        | When deleted                                                                                                                                    |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `refresh`      | `auth`    | Kept for **1 day after expiry** (override with `--grace-ms`), then deleted                                                                      |
| `emailcode`    | `auth`    | Kept for **rate-limit window + cooldown + 1h** from creation (fallback: expiry). Not deleted when the code itself expires                       |
| `verification` | `auth`    | Same idea: kept for **24h window + 30m cooldown + 1h** from creation (fallback: expiry)                                                         |
| invite         | `invites` | Deleted once `expiry` has passed (no extra wait by default; `--grace-ms` can add one). Exhausted-but-unexpired invites are **kept** by default  |
| `longlived`    | `auth`    | Opt-in (`--include-longlived`): revoked or expired tokens kept **30 days** for audit, then deleted. Active non-expired tokens are never deleted |

Never touches `people`, `projects`, templates, teams, `data-*` survey DBs, or tombstones.

## Local usage

From the `api` package (requires Conductor `.env` / Couch connectivity):

```bash
pnpm run ttl-cleanup --dry-run
pnpm run ttl-cleanup
pnpm run ttl-cleanup --include-longlived --compact
pnpm --filter=@faims3/api ttl-cleanup --dry-run
```

Useful flags:

| Flag                         | Default                                  | Purpose                                                          |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `--dry-run`                  | off                                      | Count/log candidates only                                        |
| `--compact`                  | off                                      | `POST /{db}/_compact` on auth + invites after successful deletes |
| `--grace-ms <n>`             | 1d for refresh; 0 for invites unless set | How long to keep refresh/invite docs after they expire           |
| `--include-longlived`        | off                                      | Enable long-lived sweep                                          |
| `--delete-exhausted-invites` | off                                      | Also delete non-expired invites with exhausted capped uses       |
| `--batch-size <n>`           | 100                                      | `bulkDocs` chunk size                                            |

Exit `0` on success (including dry-run); non-zero on Couch connection failure or delete errors above threshold.

Implementation: `api/src/couchdb/ttlCleanup.ts` (retention + sweep) and
`api/src/scripts/ttlCleanup.ts` (CLI). Unit tests: `api/test/ttlCleanup.test.ts`.

## Production image

The API image (`Dockerfile.build`) defaults to `node index.js`. Override the
container command to run the compiled script, e.g.:

```text
node /app/api/build/src/scripts/ttlCleanup.js --dry-run
```

(WORKDIR under `NODE_RUN_DIR` may already be `/app/api/build/src`, in which case
`node scripts/ttlCleanup.js` is enough — match the CDK task definition.)

## AWS schedule

On AWS, cleanup runs as a **separate one-shot Fargate task** scheduled by
EventBridge Scheduler (`taskCount: 1`), not as in-process cron on the Conductor
service (which would race across scaled tasks). See
[infrastructure/aws-cdk/README.md](../../../../../infrastructure/aws-cdk/README.md)
(`ttlCleanup` config) and the `FaimsTtlCleanup` construct.

### Cron timezone

`scheduleExpression` hours are interpreted in `scheduleExpressionTimezone`
(EventBridge `ScheduleExpressionTimezone`), **not** UTC by default:

| Config key                   | Default             | Meaning                                |
| ---------------------------- | ------------------- | -------------------------------------- |
| `scheduleExpression`         | `cron(0 2 * * ? *)` | Minute / hour / … for EventBridge cron |
| `scheduleExpressionTimezone` | `Australia/Sydney`  | IANA zone for that cron                |

So the sample daily run is **02:00 Australia/Sydney** and stays on local 02:00
through AEST (UTC+10) and AEDT (UTC+11). To target a fixed UTC hour instead, set
`scheduleExpressionTimezone` to `UTC` and adjust the cron hour accordingly.

Config flags map to CLI argv via `buildTtlCleanupCommand`:

| Config key               | CLI flag                     | Default |
| ------------------------ | ---------------------------- | ------- |
| `dryRun`                 | `--dry-run`                  | `false` |
| `compact`                | `--compact`                  | `false` |
| `includeLongLived`       | `--include-longlived`        | `false` |
| `deleteExhaustedInvites` | `--delete-exhausted-invites` | `false` |

Suggested ops order: ship an API image that includes the script → enable the
schedule with `dryRun: true` in staging → enable deletes → keep `compact: false`
on the daily schedule (compact manually or on a rarer cadence).
