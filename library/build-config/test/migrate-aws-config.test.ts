// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateOldAwsConfig,
  renderReport,
  deepMerge,
  type SecretFetcher,
} from '../scripts/migrate-aws-config';
import {parseBuildConfig} from '../src/build-config';

// Sentinel secret values: distinctive strings that must never appear in
// core.json, aws.json, or the rendered report.
const SMTP_PASS = 'SENTINEL-smtp-password-9f3a';
const AUTH_SECRET = 'SENTINEL-google-client-secret-71bc';
const COUCH_PASS = 'SENTINEL-couch-password-44d0';
const COOKIE = 'SENTINEL-cookie-secret-88e1';

const legacy = {
  stackName: 'ExampleStack',
  hostedZone: {id: 'Z123', name: 'example.com'},
  certificates: {primary: 'arn:cert:p', cloudfront: 'arn:cert:c'},
  aws: {account: '123456789012', region: 'ap-southeast-2'},
  secrets: {
    privateKey: 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk',
    publicKey: 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pubk',
  },
  uiConfiguration: {
    uiTheme: 'bssTheme',
    notebookListType: 'headings',
    notebookName: 'survey',
    appName: 'Example App',
    appId: 'au.example.app',
    headingAppName: 'Example',
    offlineMaps: {
      mapSource: 'maptiler',
      mapSourceKey: 'map-key-public',
      satelliteSource: 'maptiler',
      offlineMaps: true,
      mapStyle: 'basic',
    },
    addressAutosuggest: {
      source: 'MAPBOX',
      mapboxKey: 'pk.mapbox-public',
      mapboxAddressCountry: 'AU,NZ',
    },
    forceRemoteDeletion: 'allow',
    deleteOnDeactivation: true,
    excludedTeamRoles: ['TEAM_MEMBER_CREATOR'],
    enablePlansInDesigner: false,
    showStatusTab: false,
  },
  supportLinks: {
    supportEmail: 'help@example.com',
    privacyPolicyUrl: 'https://example.com/privacy',
    contactUrl: 'https://example.com/contact',
    docsUrl: 'https://docs.example.com',
  },
  couch: {volumeSize: 100, instanceType: 't3.small', couchVersionTag: '3.5.2'},
  backup: {vaultName: 'example-vault', retentionDays: 5},
  conductor: {
    name: 'Example Server',
    description: 'An example deployment',
    conductorDockerImage: 'ghcr.io/example/faims3-api',
    conductorDockerImageTag: 'sha-abc123',
    shortCodePrefix: 'EXM',
    provisionSSOUsersPolicy: 'own-team',
    cpu: 1024,
    memory: 2048,
    autoScaling: {
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 3,
      targetCpuUtilization: 60,
      targetMemoryUtilization: 65,
      scaleInCooldown: 600,
      scaleOutCooldown: 120,
    },
    localhostWhitelist: true,
    disableMigrateOnStartup: false,
    startupMigrationLockTimeoutMs: 1800000,
  },
  domains: {
    baseDomain: 'example.com',
    conductor: 'conductor',
    couch: 'couchdb',
    faims: 'faims',
    web: 'web',
    docs: 'docs',
  },
  mobileApps: {
    androidAppPublicUrl: 'https://play.example.com/app',
    iosAppPublicUrl: 'https://apps.example.com/app',
  },
  web: {title: 'Example Control Centre'},
  smtp: {
    emailServiceType: 'SMTP',
    fromEmail: 'noreply@example.com',
    fromName: 'Example Mail',
    replyTo: 'help@example.com',
    testEmailAddress: 'test@example.com',
    cacheExpirySeconds: 300,
    credentialsSecretArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:smtp',
  },
  authProviders: {
    disableLocalLogin: true,
    providers: ['google', 'vanguard'],
    secretArn: 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:auth',
    config: {
      google: {
        type: 'google',
        index: 1,
        displayName: 'Google',
        helperText: 'Login with Google',
        scope: 'profile,email',
      },
      vanguard: {
        type: 'saml',
        index: 3,
        displayName: 'VANguard',
        scope: 'profile email',
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://conductor.example.com/',
        idpPublicKey: 'IDP-PUBLIC-CERT',
        authnRequestBinding: 'HTTP-POST',
        signatureAlgorithm: 'sha256',
      },
    },
  },
  security: {
    maximumLongLivedTokenDurationDays: 45,
    rateLimiterEnabled: false,
    authAttemptLimiterEnabled: false,
  },
  bugMonitoring: {bugsnagKey: 'bugsnag-public-key'},
  // Legacy/unknown fields the migration must flag, not silently carry over.
  spatialCapacity: {maxCapacity: 4},
};

function fakeFetcher(): SecretFetcher {
  return {
    async getSecretValue(secretId: string): Promise<string> {
      if (secretId.endsWith(':smtp') || secretId.includes('smtp')) {
        return JSON.stringify({
          host: 'smtp.example.com',
          port: '2525',
          secure: 'false',
          user: 'smtp-user',
          pass: SMTP_PASS,
        });
      }
      if (secretId.includes('auth')) {
        return JSON.stringify({
          'google-clientID': 'google-client-id',
          'google-clientSecret': AUTH_SECRET,
          'vanguard-privateKey': 'SAML-PRIVATE-KEY',
          'vanguard-publicKey': 'SAML-PUBLIC-KEY',
        });
      }
      if (secretId.includes('couch')) {
        return JSON.stringify({username: 'admin', password: COUCH_PASS});
      }
      if (secretId.includes('cookie')) return COOKIE;
      throw new Error('unexpected secret id');
    },
    async describeSecret(): Promise<boolean> {
      return true;
    },
    async listSecrets() {
      return [
        {
          name: 'ExampleStack/CouchDBAdminPassword-abc',
          arn: 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:couch',
          description: 'CouchDB admin',
        },
        {
          name: 'ExampleStack/conductorcookiesecret-def',
          arn: 'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:cookie',
          // The real CDK description contains the word "couch" — discovery
          // must match on name only or this becomes a false CouchDB
          // candidate and the CouchDB secret is refused as ambiguous.
          description:
            'Contains a randomly generated string used for cookie auth in conductor and couch',
        },
      ];
    },
  };
}

test('legacy AWS config migrates to core + secrets + aws that all validate', async () => {
  const result = await migrateOldAwsConfig(legacy, fakeFetcher());

  // Core spot checks across the renamed/restructured fields.
  const core = result.core as any;
  assert.equal(core.branding.theme, 'bssTheme');
  assert.equal(core.branding.appName, 'Example App');
  assert.equal(core.branding.conductorInstanceName, 'Example Server');
  assert.equal(core.branding.websiteTitle, 'Example Control Centre');
  assert.equal(core.android.appId, 'au.example.app');
  assert.equal(core.maps.autosuggestSource, 'mapbox');
  assert.deepEqual(core.maps.mapboxAddressCountry, ['AU', 'NZ']);
  assert.equal(core.sync.forceRemoteDeletion, 'allow');
  assert.deepEqual(core.teamAndRolePolicy.excludedTeamRoles, [
    'TEAM_MEMBER_CREATOR',
  ]);
  assert.equal(core.auth.disableLocalLogin, true);
  assert.equal(core.auth.provisionSsoUsersPolicy, 'own-team');
  assert.equal(core.auth.keySource, 'AWS_SM');
  // Legacy lock semantics: hard-enabled unless disabled -> true.
  assert.equal(core.migration.startupMigrationLockEnabled, true);
  assert.equal(core.authTokens.maximumLongLivedDurationDays, 45);
  // Renamed limiter.
  assert.equal(core.limits.attemptLimiterEnabled, false);
  assert.equal(core.limits.rateLimiterEnabled, false);
  // Domain model: legacy `faims` service renamed to `app`, endpoints derive.
  assert.equal(core.domains.services.app, 'faims');
  // SMTP non-secret half comes from the fetched secret.
  assert.equal(core.email.smtpHost, 'smtp.example.com');
  assert.equal(core.email.smtpPort, 2525);
  assert.equal(core.email.smtpSecure, false);
  assert.equal(core.email.emailFromAddress, 'noreply@example.com');
  // Provider definitions: scope string split, secrets stripped, id added,
  // IdP public cert kept in core.
  assert.deepEqual(core.authProviders.google.scope, ['profile', 'email']);
  assert.equal(core.authProviders.google.id, 'google');
  assert.equal(core.authProviders.google.clientSecret, undefined);
  assert.equal(core.authProviders.vanguard.idpPublicKey, 'IDP-PUBLIC-CERT');
  assert.deepEqual(core.authProviders.vanguard.scope, ['profile', 'email']);

  // Both the committed core and the merged config must parse.
  assert.doesNotThrow(() => parseBuildConfig(result.core));
  const merged = parseBuildConfig(deepMerge(result.core, result.secrets));
  assert.equal(merged.email.smtpPassword, SMTP_PASS);
  assert.equal(merged.couchdb.couchdbPassword, COUCH_PASS);
  assert.equal(merged.auth.cookieSecret, COOKIE);
  assert.equal((merged.authProviders.google as any).clientSecret, AUTH_SECRET);
  assert.equal(merged.endpoints.apiUrl, 'https://conductor.example.com');

  // AWS slot spot checks.
  const aws = result.aws as any;
  assert.equal(aws.stackName, 'ExampleStack');
  assert.equal(aws.account, '123456789012');
  assert.equal(aws.smtpCredentialsSecretArn, legacy.smtp.credentialsSecretArn);
  assert.equal(
    aws.conductor.conductorDockerImage,
    'ghcr.io/example/faims3-api'
  );
  assert.equal(aws.conductor.name, undefined);
  assert.deepEqual(aws.authProviders.providers, ['google', 'vanguard']);
  assert.equal(aws.domains.faims, 'faims');
  assert.equal(result.awsCdk.aws, result.aws);
  assert.equal(result.awsCdk.core, result.core);

  // Unknown legacy fields are reported as dropped, not carried over.
  assert.ok(
    result.report.some(
      e => e.level === 'warn' && e.message.includes('spatialCapacity')
    )
  );
});

test('secret values never leak into core, aws, or the report', async () => {
  const result = await migrateOldAwsConfig(legacy, fakeFetcher());
  const reportText = renderReport(result, 'legacy.json');
  for (const haystack of [
    JSON.stringify(result.core),
    JSON.stringify(result.aws),
    JSON.stringify(result.awsCdk.aws),
    reportText,
    JSON.stringify(result.report),
  ]) {
    for (const sentinel of [SMTP_PASS, AUTH_SECRET, COUCH_PASS, COOKIE]) {
      assert.ok(
        !haystack.includes(sentinel),
        `secret value leaked outside secrets.json`
      );
    }
  }
  // ...but they are all in secrets.json's overlay groups.
  const secrets = result.secrets as any;
  assert.equal(secrets.email.smtpPassword, SMTP_PASS);
  assert.equal(secrets.authProviders.google.clientSecret, AUTH_SECRET);
  assert.equal(secrets.couchdb.couchdbPassword, COUCH_PASS);
  assert.equal(secrets.auth.cookieSecret, COOKIE);
});

test('offline (--no-aws) migration keeps ARNs and reports unresolved secrets', async () => {
  const result = await migrateOldAwsConfig(legacy, null);
  const secrets = result.secrets as any;
  // SM-only values are absent...
  assert.equal(secrets.email, undefined);
  assert.equal(secrets.couchdb, undefined);
  // ...but the ARNs survive for AWS resolution, the merged config still
  // parses (build-config defaults fill the gaps), and the gap is reported.
  assert.equal(
    (result.aws as any).smtpCredentialsSecretArn,
    legacy.smtp.credentialsSecretArn
  );
  assert.doesNotThrow(() =>
    parseBuildConfig(deepMerge(result.core, result.secrets))
  );
  assert.ok(
    result.report.some(
      e => e.level === 'warn' && e.message.includes('No CouchDB password')
    )
  );
});

test('already-migrated {core, aws} input is rejected', async () => {
  await assert.rejects(
    () => migrateOldAwsConfig({core: {}, aws: {}}, null),
    /already looks like the new/
  );
});
