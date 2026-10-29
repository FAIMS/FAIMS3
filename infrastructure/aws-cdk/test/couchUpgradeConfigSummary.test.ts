import {
  summarizeCouchUpgradeConfig,
  tryLoadCouchUpgradeConfigSummary,
} from '../scripts/couchUpgradeConfigSummary';

const sample = {
  aws: {
    stackName: 'faims-test',
    couch: {couchVersionTag: '3.3.3', volumeSize: 100},
    backup: {vaultName: 'faims-backup'},
    domains: {couch: 'couchdb', baseDomain: 'example.com'},
  },
};

describe('summarizeCouchUpgradeConfig', () => {
  it('records stack, couch, backup, and host from the two-file layout', () => {
    expect(summarizeCouchUpgradeConfig(sample)).toEqual({
      stackName: 'faims-test',
      couchVersionTag: '3.3.3',
      volumeSize: 100,
      backup: {vaultName: 'faims-backup'},
      couchHost: 'couchdb.example.com',
    });
  });
});

describe('tryLoadCouchUpgradeConfigSummary', () => {
  it('returns the summary when the loader succeeds', () => {
    expect(tryLoadCouchUpgradeConfigSummary(() => sample)).toEqual(
      summarizeCouchUpgradeConfig(sample)
    );
  });

  it('swallows loader errors', () => {
    expect(
      tryLoadCouchUpgradeConfigSummary(() => {
        throw new Error('missing config');
      })
    ).toBeUndefined();
  });
});
