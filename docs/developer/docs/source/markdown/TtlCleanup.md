# TTL cleanup of ephemeral CouchDB documents

Ephemeral auth and invite documents expire in application logic, but CouchDB
does not purge them automatically. Conductor provides a **one-shot CLI** that
deletes eligible docs after retention windows that preserve auth rate-limiting.

We don't currently utilise the CouchDB \_purge mechanism. Compacting deleted
records will leave very minimal data, and it is not currently seen as
worthwhile purging documents.

## What is cleaned

| Doc type       | DB        | When deleted                                                                                                               |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `refresh`      | `auth`    | `expiryTimestampMs` older than now + grace (default 1 day)                                                                 |
| `emailcode`    | `auth`    | Anchor (`createdTimestampMs`, else expiry) older than rate-limit window + cooldown + grace (not at code expiry alone)      |
| `verification` | `auth`    | Same model with verification window (24h) + cooldown (30m) + grace                                                         |
| invite         | `invites` | `expiry` in the past (+ optional grace). Exhausted-but-unexpired invites are **kept** by default                           |
| `longlived`    | `auth`    | Opt-in (`--include-longlived`): revoked or past expiry, after 30d audit retention. Never deletes active non-expired tokens |

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

| Flag                         | Default                                            | Purpose                                                          |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `--dry-run`                  | off                                                | Count/log candidates only                                        |
| `--compact`                  | off                                                | `POST /{db}/_compact` on auth + invites after successful deletes |
| `--grace-ms <n>`             | 1d (refresh); also overrides invite grace when set | Extra retention after expiry                                     |
| `--include-longlived`        | off                                                | Enable long-lived sweep                                          |
| `--delete-exhausted-invites` | off                                                | Also delete non-expired invites with exhausted capped uses       |
| `--batch-size <n>`           | 100                                                | `bulkDocs` chunk size                                            |

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
