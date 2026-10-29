export type CouchUpgradeConfig = {
  aws: {
    stackName: string;
    couch: {couchVersionTag: string; volumeSize: number};
    backup: unknown;
    domains: {couch: string; baseDomain: string};
  };
};

/** Fields recorded in a Couch upgrade baseline from the two-file CDK config. */
export function summarizeCouchUpgradeConfig(
  cfg: CouchUpgradeConfig
): Record<string, unknown> {
  return {
    stackName: cfg.aws.stackName,
    couchVersionTag: cfg.aws.couch.couchVersionTag,
    volumeSize: cfg.aws.couch.volumeSize,
    backup: cfg.aws.backup,
    couchHost: `${cfg.aws.domains.couch}.${cfg.aws.domains.baseDomain}`,
  };
}

/** Best-effort config summary: swallow loader errors so the baseline remains useful. */
export function tryLoadCouchUpgradeConfigSummary(
  load: () => CouchUpgradeConfig
): Record<string, unknown> | undefined {
  try {
    return summarizeCouchUpgradeConfig(load());
  } catch {
    return undefined;
  }
}
