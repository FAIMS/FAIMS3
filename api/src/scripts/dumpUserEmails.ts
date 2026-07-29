/* eslint-disable n/no-process-exit */
/**
 * Dump user email addresses from the people DB for maintenance notices.
 *
 * Usage (from api/, with .env pointing at the target Couch):
 *   pnpm run dump-user-emails
 *   pnpm run dump-user-emails -- --format=csv
 *   pnpm run dump-user-emails -- --format=bcc --include-disabled
 *   pnpm run dump-user-emails -- --skip=test,example\\.com
 *   pnpm run dump-user-emails -- --no-skip
 *
 * Formats:
 *   lines  one email per line (default) — paste into BCC / mailing tools
 *   bcc    comma-separated on one line — paste into a single BCC field
 *   csv    name,email,user_id,disabled,verified — for a spreadsheet
 *
 * Skip: emails matching any --skip regex are excluded (case-insensitive).
 * Default skip list: test, demo (anywhere), example\.com
 */
import {isPeopleUserAccountDisabled} from '@faims3/data-model';
import {filterPeopleUsersForList, getUsers} from '../couchdb/users';

type Format = 'lines' | 'bcc' | 'csv';

/** Default patterns: "test"/"demo" anywhere in the address; example.com domain. */
const DEFAULT_SKIP_PATTERNS = ['test', 'demo', String.raw`example\.com`];

function parseArgs(argv: string[]): {
  format: Format;
  includeDisabled: boolean;
  skipPatterns: string[];
} {
  let format: Format = 'lines';
  let includeDisabled = false;
  let skipPatterns: string[] | undefined;
  let noSkip = false;

  for (const arg of argv) {
    if (arg === '--include-disabled') {
      includeDisabled = true;
      continue;
    }
    if (arg === '--no-skip') {
      noSkip = true;
      continue;
    }
    if (arg.startsWith('--skip=')) {
      const raw = arg.slice('--skip='.length);
      skipPatterns = raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length) as Format;
      if (value !== 'lines' && value !== 'bcc' && value !== 'csv') {
        throw new Error(`Unknown format '${value}'. Use lines, bcc, or csv.`);
      }
      format = value;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      console.log(`Usage: pnpm run dump-user-emails -- [options]

Options:
  --format=lines|bcc|csv   Output format (default: lines)
  --include-disabled       Include disabled accounts
  --skip=pat1,pat2         Comma-separated regexes; exclude matching emails
                           (default: test,demo,example\\.com)
  --no-skip                Do not exclude any emails by pattern
`);
      process.exit(0);
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (noSkip) {
    skipPatterns = [];
  } else if (skipPatterns === undefined) {
    skipPatterns = [...DEFAULT_SKIP_PATTERNS];
  }

  return {format, includeDisabled, skipPatterns};
}

function compileSkipMatchers(patterns: string[]): RegExp[] {
  return patterns.map(pattern => {
    try {
      return new RegExp(pattern, 'i');
    } catch {
      throw new Error(`Invalid --skip regex: ${pattern}`);
    }
  });
}

function shouldSkipEmail(email: string, matchers: RegExp[]): boolean {
  return matchers.some(re => re.test(email));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const main = async () => {
  try {
    const {format, includeDisabled, skipPatterns} = parseArgs(
      process.argv.slice(2)
    );
    const skipMatchers = compileSkipMatchers(skipPatterns);
    const users = filterPeopleUsersForList(await getUsers(), includeDisabled);

    type Row = {
      email: string;
      name: string;
      userId: string;
      disabled: boolean;
      verified: boolean;
    };

    const rows: Row[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const user of users) {
      for (const entry of user.emails ?? []) {
        const email = (entry.email ?? '').trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        if (shouldSkipEmail(email, skipMatchers)) {
          skipped += 1;
          continue;
        }
        seen.add(email);
        rows.push({
          email,
          name: user.name ?? '',
          userId: user.user_id ?? user._id,
          disabled: isPeopleUserAccountDisabled(user),
          verified: entry.verified === true,
        });
      }
    }

    rows.sort((a, b) => a.email.localeCompare(b.email));

    // Counts go to stderr so stdout stays paste-ready for mail clients.
    console.error(
      `users=${users.length} emails=${rows.length} skipped=${skipped}` +
        ` format=${format}` +
        (includeDisabled ? ' includeDisabled' : '') +
        (skipPatterns.length
          ? ` skip=${JSON.stringify(skipPatterns)}`
          : ' no-skip')
    );

    if (format === 'lines') {
      for (const row of rows) {
        console.log(row.email);
      }
    } else if (format === 'bcc') {
      console.log(rows.map(r => r.email).join(', '));
    } else {
      console.log('name,email,user_id,disabled,verified');
      for (const row of rows) {
        console.log(
          [
            csvEscape(row.name),
            csvEscape(row.email),
            csvEscape(row.userId),
            row.disabled ? 'true' : 'false',
            row.verified ? 'true' : 'false',
          ].join(',')
        );
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to dump user emails:', error);
    process.exit(1);
  }
};

main();
