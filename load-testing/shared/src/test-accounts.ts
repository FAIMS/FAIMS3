import {z} from 'zod';

/**
 * Separators between username and password in each entry.
 * Prefer `::` in shell .env files — unquoted `||` is interpreted as bash logical OR.
 */
export const LOAD_TEST_ACCOUNT_SEPARATORS = ['::', '||'] as const;
/** Default when formatting accounts for .env / ECS. */
export const LOAD_TEST_ACCOUNT_SEPARATOR = '::';

export const LoadTestAccountSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoadTestAccount = z.infer<typeof LoadTestAccountSchema>;

export const LOAD_TEST_ACCOUNTS_ENV_VAR = 'LOAD_TEST_ACCOUNTS';

const MIN_ACCOUNTS = 1;
const MAX_ACCOUNTS = 50;

function parseAccountEntry(entry: string): LoadTestAccount {
  for (const sep of LOAD_TEST_ACCOUNT_SEPARATORS) {
    const idx = entry.indexOf(sep);
    if (idx >= 0) {
      return LoadTestAccountSchema.parse({
        username: entry.slice(0, idx).trim(),
        password: entry.slice(idx + sep.length).trim(),
      });
    }
  }
  throw new Error(
    `Invalid account entry "${entry}": expected username::password ` +
      `(use :: in unquoted .env; || only works when the whole value is quoted)`
  );
}

/**
 * Parse LOAD_TEST_ACCOUNTS from env.
 * Entries: `username::password` (or `username||password`), separated by commas and/or newlines.
 */
export function parseLoadTestAccounts(raw: string): LoadTestAccount[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${LOAD_TEST_ACCOUNTS_ENV_VAR} is empty`);
  }

  const entries = trimmed
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const accounts = entries.map(parseAccountEntry);

  if (accounts.length < MIN_ACCOUNTS) {
    throw new Error(
      `${LOAD_TEST_ACCOUNTS_ENV_VAR} must include at least ${MIN_ACCOUNTS} account`
    );
  }
  if (accounts.length > MAX_ACCOUNTS) {
    throw new Error(
      `${LOAD_TEST_ACCOUNTS_ENV_VAR} supports at most ${MAX_ACCOUNTS} accounts`
    );
  }

  const seen = new Set<string>();
  for (const {username} of accounts) {
    const key = username.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate load-test account username: ${username}`);
    }
    seen.add(key);
  }

  return accounts;
}

/** Single-line value suitable for coordinator .env / run-task overrides. */
export function formatLoadTestAccounts(accounts: LoadTestAccount[]): string {
  return accounts
    .map(
      ({username, password}) =>
        `${username}${LOAD_TEST_ACCOUNT_SEPARATOR}${password}`
    )
    .join(',');
}
