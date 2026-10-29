import test from 'node:test';
import assert from 'node:assert/strict';
import {generateEnv} from '../src/generate-build-config';
import {parseApiEnv} from '../src/client-env/api-env';
import {parseAppEnv} from '../src/client-env/app-env';
import {parseDesignerEnv} from '../src/client-env/designer-env';
import {parseWebEnv} from '../src/client-env/web-env';
import type {PartialBuildConfig} from '../src/build-config';

const MINIMAL_APP = {
  VITE_CONDUCTOR_URL: 'http://localhost:8080',
  VITE_APP_NAME: 'FAIMS',
  VITE_APP_ID: 'org.fedarch.faims3',
};

const MINIMAL_WEB = {
  VITE_WEB_URL: 'http://localhost:3001',
  VITE_API_URL: 'http://localhost:8080',
  VITE_APP_URL: 'http://localhost:3000',
  VITE_APP_NAME: 'FAIMS',
};

const MINIMAL_API = {
  CONDUCTOR_PUBLIC_URL: 'http://localhost:8080',
  WEB_APP_PUBLIC_URL: 'http://localhost:3000',
  COUCHDB_INTERNAL_URL: 'http://localhost:5984',
  COUCHDB_PUBLIC_URL: 'http://localhost:5984',
  COUCHDB_USER: 'admin',
  COUCHDB_PASSWORD: 'aSecretPasswordThatCantBeGuessed',
  REDIRECT_WHITELIST: 'http://localhost:3000,http://localhost:3001',
  EMAIL_SERVICE_TYPE: 'MOCK',
  ATTACHMENT_STORAGE_TYPE: 'MOCK',
};

function envMap(output: string): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const line of output.split('\n')) {
    if (!line.includes('=')) continue;
    const idx = line.indexOf('=');
    raw[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return raw;
}

test('parseAppEnv / parseWebEnv / parseApiEnv reject empty env', () => {
  assert.throws(
    () => parseAppEnv({}),
    /VITE_CONDUCTOR_URL|VITE_APP_NAME|VITE_APP_ID/
  );
  assert.throws(
    () => parseWebEnv({}),
    /VITE_WEB_URL|VITE_API_URL|VITE_APP_URL|VITE_APP_NAME/
  );
  assert.throws(
    () => parseApiEnv({}),
    /CONDUCTOR_PUBLIC_URL|WEB_APP_PUBLIC_URL|COUCHDB_|REDIRECT_WHITELIST/
  );
});

test('parseAppEnv requires conductor URL, app name, and app id', () => {
  assert.throws(
    () => parseAppEnv({VITE_APP_NAME: 'FAIMS', VITE_APP_ID: 'org.x'}),
    /VITE_CONDUCTOR_URL/
  );
  assert.throws(
    () =>
      parseAppEnv({
        VITE_CONDUCTOR_URL: 'http://localhost:8080',
        VITE_APP_ID: 'org.x',
      }),
    /VITE_APP_NAME/
  );
  assert.throws(
    () =>
      parseAppEnv({
        VITE_CONDUCTOR_URL: 'http://localhost:8080',
        VITE_APP_NAME: 'FAIMS',
      }),
    /VITE_APP_ID/
  );
});

test('parseWebEnv requires web/api/app URLs and app name', () => {
  assert.throws(
    () =>
      parseWebEnv({
        VITE_API_URL: 'http://localhost:8080',
        VITE_APP_URL: 'http://localhost:3000',
        VITE_APP_NAME: 'FAIMS',
      }),
    /VITE_WEB_URL/
  );
});

test('parseApiEnv requires couch credentials and redirect whitelist', () => {
  assert.throws(
    () =>
      parseApiEnv({
        CONDUCTOR_PUBLIC_URL: 'http://localhost:8080',
        WEB_APP_PUBLIC_URL: 'http://localhost:3000',
        COUCHDB_INTERNAL_URL: 'http://localhost:5984',
        COUCHDB_PUBLIC_URL: 'http://localhost:5984',
        COUCHDB_USER: 'admin',
        REDIRECT_WHITELIST: 'http://localhost:3000',
      }),
    /COUCHDB_PASSWORD/
  );
  assert.throws(
    () =>
      parseApiEnv({
        ...MINIMAL_API,
        REDIRECT_WHITELIST: '',
      }),
    /REDIRECT_WHITELIST/
  );
});

test('parseApiEnv requires SMTP credentials when EMAIL_SERVICE_TYPE is SMTP', () => {
  assert.throws(
    () =>
      parseApiEnv({
        ...MINIMAL_API,
        EMAIL_SERVICE_TYPE: 'SMTP',
      }),
    /SMTP/
  );
  const parsed = parseApiEnv({
    ...MINIMAL_API,
    EMAIL_SERVICE_TYPE: 'SMTP',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'pass',
  });
  assert.equal(parsed.emailServiceType, 'SMTP');
  assert.equal(parsed.smtp?.host, 'smtp.example.com');
  assert.equal(parsed.smtp?.secure, false);
});

test('parseApiEnv restores FILE-key and instance-name fallbacks when profile env is blank', () => {
  const omitted = parseApiEnv(MINIMAL_API);
  assert.equal(omitted.conductorKeyId, 'test');
  assert.equal(omitted.keyFileHost, 'conductor');
  assert.equal(omitted.conductorInstanceName, 'test');

  const profileOnly = parseApiEnv({
    ...MINIMAL_API,
    PROFILE_NAME: 'prod',
  });
  assert.equal(profileOnly.conductorKeyId, 'prod');
  assert.equal(profileOnly.keyFileHost, 'prod');
  assert.equal(profileOnly.conductorInstanceName, 'prod');

  const both = parseApiEnv({
    ...MINIMAL_API,
    PROFILE_NAME: 'prod',
    CONDUCTOR_INSTANCE_NAME: 'Example Server',
  });
  assert.equal(both.conductorKeyId, 'prod');
  assert.equal(both.keyFileHost, 'prod');
  assert.equal(both.conductorInstanceName, 'Example Server');
});

test('parseApiEnv leaves testEmailAddress undefined outside test unless set', () => {
  const outsideTest = parseApiEnv(MINIMAL_API, {runningUnderTest: false});
  assert.equal(outsideTest.testEmailAddress, undefined);

  const underTest = parseApiEnv(MINIMAL_API, {runningUnderTest: true});
  assert.equal(underTest.testEmailAddress, 'fake@gmail.com');

  const explicit = parseApiEnv(
    {...MINIMAL_API, TEST_EMAIL_ADDRESS: 'ops@example.org'},
    {runningUnderTest: false}
  );
  assert.equal(explicit.testEmailAddress, 'ops@example.org');
});

test('generated api env without couchdb.password fails parseApiEnv', () => {
  const env = generateEnv({
    config: {
      endpoints: {
        apiUrl: 'https://api.example.org',
        appUrl: 'https://app.example.org',
        webUrl: 'https://web.example.org',
      },
      email: {emailServiceType: 'MOCK'},
    },
    platform: 'api',
  });
  assert.throws(() => parseApiEnv(envMap(env)), /COUCHDB_PASSWORD/);
});

test('parseApiEnv treats omitted SMTP_SECURE as STARTTLS and honours an explicit true', () => {
  const omitted = parseApiEnv({
    ...MINIMAL_API,
    EMAIL_SERVICE_TYPE: 'SMTP',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'pass',
  });
  assert.equal(omitted.smtp?.secure, false);

  const implicitTls = parseApiEnv({
    ...MINIMAL_API,
    EMAIL_SERVICE_TYPE: 'SMTP',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'pass',
    SMTP_SECURE: 'true',
  });
  assert.equal(implicitTls.smtp?.secure, true);
});

test('parseApiEnv forces MOCK email under test even when SMTP is configured', () => {
  const parsed = parseApiEnv(
    {
      ...MINIMAL_API,
      EMAIL_SERVICE_TYPE: 'SMTP',
    },
    {runningUnderTest: true}
  );
  assert.equal(parsed.emailServiceType, 'MOCK');
  assert.equal(parsed.smtp, undefined);
  assert.equal(parsed.exportRateLimiterEnabled, false);
});

test('parseApiEnv requires S3 bucket, prefix, and region when ATTACHMENT_STORAGE_TYPE is S3', () => {
  assert.throws(
    () =>
      parseApiEnv(
        {
          ...MINIMAL_API,
          ATTACHMENT_STORAGE_TYPE: 'S3',
        },
        {runningUnderTest: false}
      ),
    /ATTACHMENT_S3_BUCKET.*ATTACHMENT_S3_PREFIX.*ATTACHMENT_S3_REGION/
  );
  const parsed = parseApiEnv(
    {
      ...MINIMAL_API,
      ATTACHMENT_STORAGE_TYPE: 'S3',
      ATTACHMENT_S3_BUCKET: 'my-bucket',
      ATTACHMENT_S3_PREFIX: 'layers',
      ATTACHMENT_S3_REGION: 'ap-southeast-2',
      ATTACHMENT_S3_ENDPOINT: 'http://localhost:9000',
    },
    {runningUnderTest: false}
  );
  assert.equal(parsed.attachmentStorageType, 'S3');
  assert.equal(parsed.attachmentStorage.bucket, 'my-bucket');
  assert.equal(parsed.attachmentStorage.prefix, 'layers');
  assert.equal(parsed.attachmentStorage.region, 'ap-southeast-2');
  assert.equal(parsed.attachmentStorage.endpoint, 'http://localhost:9000');
  assert.equal(parsed.attachmentStorage.forcePathStyle, true);
});

test('parseApiEnv forces MOCK attachment storage and capacity provider under test', () => {
  const parsed = parseApiEnv(
    {
      ...MINIMAL_API,
      ATTACHMENT_STORAGE_TYPE: 'S3',
      CAPACITY_PROVIDER: 'ECS',
    },
    {runningUnderTest: true}
  );
  assert.equal(parsed.attachmentStorageType, 'MOCK');
  assert.equal(parsed.capacityProviderType, 'MOCK');
  assert.equal(parsed.capacityEcs, undefined);
});

test('parseApiEnv requires ECS capacity fields when CAPACITY_PROVIDER is ECS outside test', () => {
  assert.throws(
    () =>
      parseApiEnv(
        {
          ...MINIMAL_API,
          CAPACITY_PROVIDER: 'ECS',
        },
        {runningUnderTest: false}
      ),
    /CAPACITY_ECS_CLUSTER/
  );
  const parsed = parseApiEnv(
    {
      ...MINIMAL_API,
      CAPACITY_PROVIDER: 'ECS',
      CAPACITY_ECS_CLUSTER: 'cluster-1',
      CAPACITY_ECS_WORKER_TASK_DEFINITION: 'arn:task-def/worker:1',
      CAPACITY_ECS_WORKER_TASK_FAMILY: 'worker',
      CAPACITY_ECS_WORKER_CONTAINER: 'spatial-worker-container',
      CAPACITY_ECS_SUBNETS: 'subnet-1, subnet-2',
      CAPACITY_ECS_SECURITY_GROUPS: 'sg-1',
    },
    {runningUnderTest: false}
  );
  assert.equal(parsed.capacityProviderType, 'ECS');
  assert.deepEqual(parsed.capacityEcs, {
    cluster: 'cluster-1',
    taskDefinition: 'arn:task-def/worker:1',
    taskFamily: 'worker',
    containerName: 'spatial-worker-container',
    subnets: ['subnet-1', 'subnet-2'],
    securityGroups: ['sg-1'],
    assignPublicIp: 'ENABLED',
  });
});

test('parseApiEnv parses spatial worker, GDAL, and observability flags', () => {
  const parsed = parseApiEnv(
    {
      ...MINIMAL_API,
      MEMORY_MONITOR_ENABLED: 'true',
      REQUEST_LOGGING_ENABLED: 'false',
      CAPACITY_MAX: '8',
      CAPACITY_SCALE_THRESHOLDS: '2,6,12',
      CAPACITY_STARVATION_MS: '0',
      CAPACITY_SCALE_IN_COOLDOWN_MS: '0',
      SPATIAL_WORKER_IDLE_EXIT_MS: '0',
      GDAL_NUM_THREADS: '4',
      GDAL_CACHEMAX: '1024',
      GDAL_WARP_MEMORY_MB: '512',
      GDAL_WARP_MULTI: 'false',
      TIPPECANOE_MAX_THREADS: '4',
    },
    {runningUnderTest: false}
  );
  assert.equal(parsed.memoryMonitorEnabled, true);
  assert.equal(parsed.requestLoggingEnabled, false);
  assert.equal(parsed.capacityMax, 8);
  assert.deepEqual(parsed.capacityScaleThresholds, [2, 6, 12]);
  assert.equal(parsed.capacityStarvationMs, 0);
  assert.equal(parsed.capacityScaleInCooldownMs, 0);
  assert.equal(parsed.spatialWorkerIdleExitMs, 0);
  assert.equal(parsed.gdalNumThreads, '4');
  assert.equal(parsed.gdalCacheMaxMb, 1024);
  assert.equal(parsed.gdalWarpMemoryMb, 512);
  assert.equal(parsed.gdalWarpMulti, false);
  assert.equal(parsed.tippecanoeMaxThreads, 4);
});

test('parseApiEnv forces disableMigrateOnStartup under test', () => {
  const omitted = parseApiEnv(MINIMAL_API, {runningUnderTest: false});
  assert.equal(omitted.disableMigrateOnStartup, false);

  const underTest = parseApiEnv(
    {
      ...MINIMAL_API,
      DISABLE_MIGRATE_ON_STARTUP: 'false',
      STARTUP_MIGRATION_LOCK_ENABLED: 'true',
    },
    {runningUnderTest: true}
  );
  assert.equal(underTest.disableMigrateOnStartup, true);
  assert.equal(underTest.startupMigrationLockEnabled, false);
});

test('parseApiEnv requires AWS_SECRET_KEY_ARN when KEY_SOURCE is AWS_SM', () => {
  assert.throws(
    () =>
      parseApiEnv({
        ...MINIMAL_API,
        KEY_SOURCE: 'AWS_SM',
      }),
    /AWS_SECRET_KEY_ARN/
  );
});

test('parseAppEnv maps a generated apps env into AppRuntimeConfig', () => {
  const config: PartialBuildConfig = {
    endpoints: {
      apiUrl: 'https://api.example.org',
      webUrl: 'https://web.example.org',
      appUrl: 'https://app.example.org',
      conductorUrls: ['https://api.example.org', 'https://api2.example.org'],
    },
    branding: {appName: 'Fieldmark', theme: 'fieldmark'},
    notebookAndRecordUX: {notebookName: 'survey', navigation: 'breadcrumbs'},
    maps: {mapSource: 'maptiler', satelliteSource: 'esri', offlineMaps: false},
    android: {appId: 'org.example.app'},
  };
  const parsed = parseAppEnv(envMap(generateEnv({config, platform: 'apps'})));
  assert.equal(parsed.appName, 'Fieldmark');
  assert.equal(parsed.headingAppName, 'Fieldmark');
  assert.equal(parsed.appId, 'org.example.app');
  assert.deepEqual(parsed.conductorUrls, [
    'https://api.example.org',
    'https://api2.example.org',
  ]);
  assert.equal(parsed.notebookName, 'survey');
  assert.equal(parsed.notebookNamePlural, 'surveys');
  assert.equal(parsed.navigationStyle, 'breadcrumbs');
  assert.equal(parsed.mapSource, 'maptiler');
  assert.equal(parsed.satelliteSource, 'esri');
  assert.equal(parsed.offlineMaps, false);
});

test('parseWebEnv maps a generated apps env into WebRuntimeConfig', () => {
  const config: PartialBuildConfig = {
    endpoints: {
      apiUrl: 'https://api.example.org',
      webUrl: 'https://web.example.org',
      appUrl: 'https://app.example.org',
    },
    branding: {appName: 'Fieldmark', websiteTitle: 'Centre'},
    notebookAndRecordUX: {notebookName: 'project'},
  };
  const parsed = parseWebEnv(envMap(generateEnv({config, platform: 'apps'})));
  assert.equal(parsed.appName, 'Fieldmark');
  assert.equal(parsed.webUrl, 'https://web.example.org');
  assert.equal(parsed.apiUrl, 'https://api.example.org');
  assert.equal(parsed.appUrl, 'https://app.example.org');
  assert.equal(parsed.webHomeUrl, 'https://web.example.org/');
  assert.equal(
    parsed.signinPath,
    'https://api.example.org/login?redirect=https://web.example.org'
  );
  assert.equal(parsed.notebookNamePlural, 'projects');
});

test('parseApiEnv maps a generated api env into ApiRuntimeConfig', () => {
  const config: PartialBuildConfig = {
    endpoints: {
      apiUrl: 'https://api.example.org',
      appUrl: 'https://app.example.org',
      webUrl: 'https://web.example.org',
      couchdbInternalUrl: 'https://couch.example.org',
      couchdbPublicUrl: 'https://couch.example.org',
      redirectWhitelist: ['https://web.example.org', 'https://app.example.org'],
    },
    branding: {
      conductorInstanceName: 'Example',
      conductorShortCodePrefix: 'EXM',
    },
    auth: {
      profileName: 'prod',
      disableLocalLogin: true,
      provisionSsoUsersPolicy: 'own-team',
    },
    authTokens: {refreshTokenExpiryMinutes: 1440, accessTokenExpiryMinutes: 60},
    limits: {rateLimiterEnabled: false, jsonBodyLimit: '50mb'},
    email: {emailServiceType: 'MOCK'},
    couchdb: {user: 'admin', password: 'pw'},
    conductor: {internalPort: 8080},
  };
  const parsed = parseApiEnv(envMap(generateEnv({config, platform: 'api'})));
  assert.equal(parsed.conductorPublicUrl, 'https://api.example.org');
  assert.equal(parsed.webAppPublicUrl, 'https://app.example.org');
  assert.equal(parsed.conductorKeyId, 'prod');
  assert.equal(parsed.localLoginEnabled, false);
  assert.equal(parsed.provisionSSOUsersPolicy, 'own-team');
  assert.equal(parsed.accessTokenExpiryMinutes, 60);
  assert.equal(parsed.refreshTokenExpiryMinutes, 1440);
  assert.equal(parsed.emailServiceType, 'MOCK');
  assert.equal(parsed.conductorInternalPort, 8080);
  assert.equal(parsed.shortCodePrefix, 'EXM');
  assert.equal(parsed.rateLimiterEnabled, false);
  assert.equal(parsed.jsonBodyLimit, '50mb');
  assert.deepEqual(parsed.redirectWhitelist, [
    'https://web.example.org',
    'https://app.example.org',
  ]);
  assert.equal(parsed.localCouchdbAuth.password, 'pw');
});

test('app env boolean vocabulary is strict', () => {
  for (const truthy of ['true', '1', 'on', 'yes']) {
    const parsed = parseAppEnv({...MINIMAL_APP, VITE_DEBUG_APP: truthy});
    assert.equal(parsed.debugApp, true, `expected ${truthy} -> true`);
  }
  for (const falsy of ['false', '0', 'off', 'no']) {
    const parsed = parseAppEnv({...MINIMAL_APP, VITE_DEBUG_APP: falsy});
    assert.equal(parsed.debugApp, false, `expected ${falsy} -> false`);
  }
  assert.throws(
    () => parseAppEnv({...MINIMAL_APP, VITE_DEBUG_APP: 'banana'}),
    /Invalid boolean/i
  );
});

test('non-numeric integer env values fail parse', () => {
  assert.throws(
    () => parseAppEnv({...MINIMAL_APP, VITE_POUCH_BATCH_SIZE: 'ten'}),
    /positive integer/i
  );
  assert.throws(
    () =>
      parseWebEnv({
        ...MINIMAL_WEB,
        VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: 'abc',
      }),
    /MAXIMUM_LONG_LIVED_DURATION_DAYS/
  );
});

test('parseAppEnv rejects blank conductor URL CSV', () => {
  assert.throws(
    () => parseAppEnv({...MINIMAL_APP, VITE_CONDUCTOR_URL: ''}),
    /VITE_CONDUCTOR_URL/
  );
  assert.throws(
    () => parseAppEnv({...MINIMAL_APP, VITE_CONDUCTOR_URL: ', ,,  ,'}),
    /VITE_CONDUCTOR_URL/
  );
  const trailing = parseAppEnv({
    ...MINIMAL_APP,
    VITE_CONDUCTOR_URL: 'https://api2.example.org,',
  });
  assert.deepEqual(trailing.conductorUrls, ['https://api2.example.org']);
});

test('commit version is sanitised on the app parser', () => {
  assert.equal(
    parseAppEnv({...MINIMAL_APP, VITE_COMMIT_VERSION: 'abcdef1'}).commitHash,
    'abcdef1'
  );
  assert.equal(
    parseAppEnv({
      ...MINIMAL_APP,
      VITE_COMMIT_VERSION: 'v1.2.3-ios-#abc1234',
    }).commitHash,
    'v1.2.3-ios-#abc1234'
  );
  assert.equal(
    parseAppEnv({
      ...MINIMAL_APP,
      VITE_COMMIT_VERSION: 'output of git rev-parse HEAD',
    }).commitHash,
    undefined
  );
});

test('bugsnag key: blank and literal false resolve to undefined', () => {
  assert.equal(
    parseAppEnv({...MINIMAL_APP, VITE_BUGSNAG_KEY: 'false'}).bugsnagKey,
    undefined
  );
  assert.equal(
    parseAppEnv({...MINIMAL_APP, VITE_BUGSNAG_KEY: ''}).bugsnagKey,
    undefined
  );
  assert.equal(
    parseAppEnv({...MINIMAL_APP, VITE_BUGSNAG_KEY: 'abc'}).bugsnagKey,
    'abc'
  );
});

test('app env enums accept historical uppercase values', () => {
  const parsed = parseAppEnv({
    ...MINIMAL_APP,
    VITE_AUTOSUGGEST_SOURCE: 'MAPBOX',
    VITE_AUTOSUGGEST_MAPBOX_KEY: 'pk',
    VITE_FORCE_REMOTE_DELETION: 'NEVER',
    VITE_MAP_SOURCE: 'OSM',
  });
  assert.equal(parsed.autosuggestSource, 'mapbox');
  assert.equal(parsed.forceRemoteDeletion, 'never');
  assert.equal(parsed.mapSource, 'osm');
});

test('blank VITE_MAP_SOURCE disables maps and survives generate→parse', () => {
  assert.equal(parseAppEnv(MINIMAL_APP).mapSource, 'osm');
  assert.equal(parseWebEnv(MINIMAL_WEB).mapSource, 'osm');
  assert.equal(
    parseAppEnv({...MINIMAL_APP, VITE_MAP_SOURCE: ''}).mapSource,
    ''
  );
  assert.equal(
    parseWebEnv({...MINIMAL_WEB, VITE_MAP_SOURCE: ''}).mapSource,
    ''
  );

  const raw = envMap(
    generateEnv({config: {maps: {mapSource: ''}}, platform: 'apps'})
  );
  assert.equal(raw.VITE_MAP_SOURCE, '');
  assert.equal(parseAppEnv({...MINIMAL_APP, ...raw}).mapSource, '');
  assert.equal(parseWebEnv({...MINIMAL_WEB, ...raw}).mapSource, '');
});

test('mapbox autosuggest requires a key on the app parser', () => {
  assert.throws(
    () => parseAppEnv({...MINIMAL_APP, VITE_AUTOSUGGEST_SOURCE: 'mapbox'}),
    /autosuggestMapboxKey|VITE_AUTOSUGGEST_MAPBOX_KEY/
  );
  const parsed = parseAppEnv({
    ...MINIMAL_APP,
    VITE_AUTOSUGGEST_SOURCE: 'mapbox',
    VITE_AUTOSUGGEST_MAPBOX_KEY: 'pk',
  });
  assert.equal(parsed.autosuggestSource, 'mapbox');
  assert.equal(parsed.mapboxAccessToken, 'pk');
});

test('country codes parse as uppercase arrays', () => {
  const parsed = parseAppEnv({
    ...MINIMAL_APP,
    VITE_MAPBOX_ADDRESS_COUNTRY: 'au,nz',
    VITE_MAPTILER_ADDRESS_COUNTRY: 'AU',
  });
  assert.deepEqual(parsed.mapboxAddressCountry, ['AU', 'NZ']);
  assert.deepEqual(parsed.maptilerAddressCountry, ['AU']);
});

test('parseDesignerEnv defaults and round-trips generated flags', () => {
  const defaults = parseDesignerEnv({});
  assert.equal(defaults.templateProtections, false);
  assert.equal(defaults.enablePlansInDesigner, true);

  const env = generateEnv({
    config: {
      webDesignerLimits: {
        templateProtections: true,
        enablePlansInDesigner: false,
      },
    },
    platform: 'apps',
  });
  const parsed = parseDesignerEnv(envMap(env));
  assert.equal(parsed.templateProtections, true);
  assert.equal(parsed.enablePlansInDesigner, false);
});

test('parseWebEnv unlimited duration maps to undefined', () => {
  const parsed = parseWebEnv({
    ...MINIMAL_WEB,
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: 'infinite',
  });
  assert.equal(parsed.maximumLongLivedDurationDays, undefined);
});

test('parseWebEnv parses VITE_EXCLUDED_TEAM_ROLES CSV and defaults to empty array', () => {
  const defaults = parseWebEnv(MINIMAL_WEB);
  assert.deepEqual(defaults.excludedTeamRoles, []);

  const parsed = parseWebEnv({
    ...MINIMAL_WEB,
    VITE_EXCLUDED_TEAM_ROLES: ' TEAM_MEMBER_CREATOR , TEAM_ADMIN , ',
  });
  assert.deepEqual(parsed.excludedTeamRoles, [
    'TEAM_MEMBER_CREATOR',
    'TEAM_ADMIN',
  ]);
});
