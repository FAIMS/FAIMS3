/* eslint-disable n/no-process-exit */
/**
 * One-shot TTL cleanup for ephemeral CouchDB documents (auth + invites).
 *
 * Deletes expired refresh tokens, email codes, verification challenges,
 * invites, and optionally long-lived tokens after retention windows that
 * preserve auth attempt rate-limiting.
 *
 * NEVER deletes:
 *   - people / projects / templates / teams / migrations docs
 *   - data-* survey record databases
 *   - survey tombstones (intentional permanent audit markers)
 *
 * Usage (from api/ or via filter):
 *   pnpm run ttl-cleanup --dry-run
 *   pnpm run ttl-cleanup
 *   pnpm run ttl-cleanup --include-longlived --compact
 *   pnpm --filter=@faims3/api ttl-cleanup --dry-run
 *
 * Flags:
 *   --dry-run                    Report candidates only; write nothing
 *   --compact                    After successful deletes, compact auth + invites
 *   --grace-ms <n>               Override refresh (and invite) grace in ms (default: 1 day)
 *   --include-longlived          Also sweep long-lived tokens (audit retention 30d)
 *   --delete-exhausted-invites   Also delete non-expired invites with exhausted uses
 *   --batch-size <n>             bulkDocs chunk size (default: 100)
 *   -h, --help                   Show this help
 *
 * Exit codes:
 *   0  success (including dry-run)
 *   1  CouchDB connection failure, fatal error, or delete errors above threshold
 *
 * Production (Dockerfile.build): override CMD to run the compiled script, e.g.
 *   node /app/api/build/src/scripts/ttlCleanup.js --dry-run
 */

import {config} from '../buildconfig';
import {verifyCouchDBConnection} from '../couchdb';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INVITE_GRACE_MS,
  DEFAULT_REFRESH_GRACE_MS,
  runTtlCleanup,
} from '../couchdb/ttlCleanup';

type CliArgs = {
  dryRun: boolean;
  compact: boolean;
  includeLongLived: boolean;
  deleteExhaustedInvites: boolean;
  graceMs: number | undefined;
  batchSize: number;
  help: boolean;
};

const showHelp = () => {
  console.log(`Usage: pnpm run ttl-cleanup [options]

One-shot cleanup of expired ephemeral auth/invite CouchDB documents.

Options:
  --dry-run                    Count/log candidates only; do not delete
  --compact                    Compact auth + invites after successful deletes
  --grace-ms <n>               Grace after refresh/invite expiry in ms (default: ${DEFAULT_REFRESH_GRACE_MS})
  --include-longlived          Enable long-lived token sweep (audit retention 30d)
  --delete-exhausted-invites   Also delete non-expired invites with exhausted uses
  --batch-size <n>             bulkDocs batch size (default: ${DEFAULT_BATCH_SIZE})
  -h, --help                   Show this help

Never deletes people, projects, data-*, or survey tombstones.
Email codes / verification challenges are retained for rate-limit window +
cooldown (+ small grace), not deleted at code expiry alone.
By default, exhausted-but-unexpired invites are kept (uses may be raised later).
`);
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    dryRun: false,
    compact: false,
    includeLongLived: false,
    deleteExhaustedInvites: false,
    graceMs: undefined,
    batchSize: DEFAULT_BATCH_SIZE,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // pnpm may forward a bare `--` separator into argv
    if (arg === '--') {
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--compact') {
      args.compact = true;
      continue;
    }
    if (arg === '--include-longlived') {
      args.includeLongLived = true;
      continue;
    }
    if (arg === '--delete-exhausted-invites') {
      args.deleteExhaustedInvites = true;
      continue;
    }
    if (arg === '--grace-ms') {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid --grace-ms value: ${raw}`);
      }
      args.graceMs = n;
      continue;
    }
    if (arg.startsWith('--grace-ms=')) {
      const n = Number(arg.slice('--grace-ms='.length));
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid --grace-ms value: ${arg}`);
      }
      args.graceMs = n;
      continue;
    }
    if (arg === '--batch-size') {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`Invalid --batch-size value: ${raw}`);
      }
      args.batchSize = n;
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      const n = Number(arg.slice('--batch-size='.length));
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`Invalid --batch-size value: ${arg}`);
      }
      args.batchSize = n;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return args;
};

const main = async () => {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    showHelp();
    process.exit(1);
  }

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log(`Couch server: ${config.couchdbInternalUrl}`);

  const connection = await verifyCouchDBConnection();
  if (!connection.valid) {
    console.error('Cannot reach CouchDB. Aborting.');
    console.error(connection.validate_error || connection.server_msg);
    if (connection.database_errors?.length) {
      for (const e of connection.database_errors) {
        console.error(`  ${e}`);
      }
    }
    process.exit(1);
  }

  const refreshGraceMs = args.graceMs ?? DEFAULT_REFRESH_GRACE_MS;
  const inviteGraceMs =
    args.graceMs !== undefined ? args.graceMs : DEFAULT_INVITE_GRACE_MS;

  const result = await runTtlCleanup({
    dryRun: args.dryRun,
    compact: args.compact,
    includeLongLived: args.includeLongLived,
    deleteExhaustedInvites: args.deleteExhaustedInvites,
    refreshGraceMs,
    inviteGraceMs,
    batchSize: args.batchSize,
  });

  process.exit(result.success ? 0 : 1);
};

main().catch(error => {
  console.error('ttlCleanup failed:', error);
  process.exit(1);
});
