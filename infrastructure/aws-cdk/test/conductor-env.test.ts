import {parseBuildConfig} from '@faims3/build-config';
import {
  authSecretEnvKey,
  authSecretFieldsForProvider,
  buildConductorRuntimeEnv,
} from '../lib/components/conductor';

const core = parseBuildConfig({
  authProviders: {
    google: {
      id: 'google',
      type: 'google',
      displayName: 'Google',
      scope: ['profile', 'email'],
      clientID: 'plain-client-id',
      clientSecret: 'plain-client-secret',
    },
    oidcExtra: {
      id: 'oidcExtra',
      type: 'oidc',
      displayName: 'Extra OIDC',
      scope: ['openid'],
      issuer: 'https://idp.example',
      authorizationURL: 'https://idp.example/auth',
      tokenURL: 'https://idp.example/token',
      userInfoURL: 'https://idp.example/user',
    },
  },
});

const secretEnvKeys = [
  'COUCHDB_PASSWORD',
  'COUCHDB_USER',
  'FAIMS_COOKIE_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  authSecretEnvKey('google', 'clientID'),
  authSecretEnvKey('google', 'clientSecret'),
];

describe('buildConductorRuntimeEnv', () => {
  const env = buildConductorRuntimeEnv({
    coreConfig: core,
    conductorEndpoint: 'https://api.example.com:443',
    webAppPublicUrl: 'https://app.example.com',
    webUrl: 'https://web.example.com',
    appId: 'org.example.app',
    couchDBEndpoint: 'https://couch.example.com:443',
    couchDBPort: 443,
    conductorExternalPort: 443,
    conductorInternalPort: 8000,
    privateKeySecretArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk',
    localhostWhitelist: false,
    enabledAuthProviders: ['google'],
    secretEnvKeys,
    mapAssetBucketName: 'faims-prod-map-assets',
    awsRegion: 'ap-southeast-2',
  });

  it('overlays resolved endpoints, ports, S3 bucket/region, and KEY_SOURCE', () => {
    expect(env.CONDUCTOR_PUBLIC_URL).toBe('https://api.example.com:443');
    expect(env.CONDUCTOR_URL).toBe('https://api.example.com:443');
    expect(env.WEB_APP_PUBLIC_URL).toBe('https://app.example.com');
    expect(env.COUCHDB_PUBLIC_URL).toBe('https://couch.example.com:443');
    expect(env.COUCHDB_EXTERNAL_PORT).toBe('443');
    expect(env.CONDUCTOR_EXTERNAL_PORT).toBe('443');
    expect(env.CONDUCTOR_INTERNAL_PORT).toBe('8000');
    expect(env.KEY_SOURCE).toBe('AWS_SM');
    expect(env.PROFILE_NAME).toBe('default');
    expect(env.STARTUP_MIGRATION_LOCK_ENABLED).toBe('true');
    expect(env.ATTACHMENT_STORAGE_TYPE).toBe('S3');
    expect(env.ATTACHMENT_S3_BUCKET).toBe('faims-prod-map-assets');
    expect(env.ATTACHMENT_S3_PREFIX).toBe('map-assets');
    expect(env.ATTACHMENT_S3_REGION).toBe('ap-southeast-2');
    expect(env.ATTACHMENT_S3_ENDPOINT).toBeUndefined();
    expect(env.ATTACHMENT_S3_ACCESS_KEY_ID).toBeUndefined();
    expect(env.REDIRECT_WHITELIST.split(',')).toEqual(
      expect.arrayContaining([
        'https://api.example.com:443',
        'https://app.example.com',
        'https://web.example.com',
        'org.example.app://',
      ])
    );
  });

  it('keeps enabled-provider AUTH_* fields from the shared map', () => {
    expect(env.AUTH_GOOGLE_DISPLAY_NAME).toBe('Google');
    expect(env.AUTH_GOOGLE_TYPE).toBe('google');
  });

  it('omits Secrets Manager keys and disabled providers from plain env', () => {
    expect(env.AUTH_GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.AUTH_GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.AUTH_OIDCEXTRA_TYPE).toBeUndefined();
    expect(env.COUCHDB_PASSWORD).toBeUndefined();
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.FAIMS_COOKIE_SECRET).toBeUndefined();
  });
});

function envForMigration(migration: {
  disableMigrateOnStartup?: boolean;
  startupMigrationLockEnabled?: boolean;
}) {
  return buildConductorRuntimeEnv({
    coreConfig: parseBuildConfig({migration}),
    conductorEndpoint: 'https://api.example.com:443',
    webAppPublicUrl: 'https://app.example.com',
    webUrl: 'https://web.example.com',
    appId: 'org.example.app',
    couchDBEndpoint: 'https://couch.example.com:443',
    couchDBPort: 443,
    conductorExternalPort: 443,
    conductorInternalPort: 8000,
    privateKeySecretArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk',
    localhostWhitelist: false,
    enabledAuthProviders: [],
    secretEnvKeys,
  });
}

describe('authSecretFieldsForProvider', () => {
  it('does not require SAML idpPublicKey from SM when core already has it', () => {
    expect(
      authSecretFieldsForProvider({
        id: 'enterprise-sso',
        type: 'saml',
        displayName: 'Enterprise SSO',
        scope: ['profile', 'email'],
        entryPoint: 'https://idp.example/sso',
        issuer: 'https://sp.example',
        idpPublicKey: 'CORE-IDP-CERT',
      })
    ).toEqual(['privateKey', 'publicKey']);
  });

  it('wires SAML idpPublicKey from SM when the core value is blank', () => {
    expect(
      authSecretFieldsForProvider({
        id: 'enterprise-sso',
        type: 'saml',
        displayName: 'Enterprise SSO',
        scope: ['profile', 'email'],
        entryPoint: 'https://idp.example/sso',
        issuer: 'https://sp.example',
        idpPublicKey: '   ',
      })
    ).toEqual(['privateKey', 'publicKey', 'idpPublicKey']);
  });

  it('wires SAML idpPublicKey from SM when core omits it', () => {
    expect(
      authSecretFieldsForProvider({
        id: 'enterprise-sso',
        type: 'saml',
        displayName: 'Enterprise SSO',
        scope: ['profile', 'email'],
        entryPoint: 'https://idp.example/sso',
        issuer: 'https://sp.example',
      })
    ).toEqual(['privateKey', 'publicKey', 'idpPublicKey']);
  });

  it('leaves Google/OIDC required fields unchanged', () => {
    expect(
      authSecretFieldsForProvider({
        id: 'google',
        type: 'google',
        displayName: 'Google',
        scope: ['profile', 'email'],
      })
    ).toEqual(['clientID', 'clientSecret']);
  });
});

describe('buildConductorRuntimeEnv SAML idpPublicKey', () => {
  const samlCore = parseBuildConfig({
    authProviders: {
      someSaml: {
        id: 'someSaml',
        type: 'saml',
        displayName: 'Enterprise SSO',
        scope: ['profile', 'email'],
        entryPoint: 'https://idp.example/sso',
        issuer: 'https://sp.example',
        idpPublicKey: 'CORE-IDP-CERT',
      },
    },
  });

  function samlEnv(secretKeys: string[]) {
    return buildConductorRuntimeEnv({
      coreConfig: samlCore,
      conductorEndpoint: 'https://api.example.com:443',
      webAppPublicUrl: 'https://app.example.com',
      webUrl: 'https://web.example.com',
      appId: 'org.example.app',
      couchDBEndpoint: 'https://couch.example.com:443',
      couchDBPort: 443,
      conductorExternalPort: 443,
      conductorInternalPort: 8000,
      privateKeySecretArn:
        'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk',
      localhostWhitelist: false,
      enabledAuthProviders: ['someSaml'],
      secretEnvKeys: secretKeys,
    });
  }

  it('keeps a core idpPublicKey in plain env when SM does not supply it', () => {
    const env = samlEnv([
      authSecretEnvKey('someSaml', 'privateKey'),
      authSecretEnvKey('someSaml', 'publicKey'),
    ]);
    expect(env.AUTH_SOMESAML_IDP_PUBLIC_KEY).toBe('CORE-IDP-CERT');
    expect(env.AUTH_SOMESAML_PRIVATE_KEY).toBeUndefined();
  });

  it('drops the core idpPublicKey from plain env when SM is wired', () => {
    const env = samlEnv([
      authSecretEnvKey('someSaml', 'privateKey'),
      authSecretEnvKey('someSaml', 'publicKey'),
      authSecretEnvKey('someSaml', 'idpPublicKey'),
    ]);
    expect(env.AUTH_SOMESAML_IDP_PUBLIC_KEY).toBeUndefined();
  });
});

describe('buildConductorRuntimeEnv startup migration lock', () => {
  it('defaults the lock on when the core omits the flag', () => {
    expect(envForMigration({}).STARTUP_MIGRATION_LOCK_ENABLED).toBe('true');
  });

  it('honours an explicit startupMigrationLockEnabled false', () => {
    expect(
      envForMigration({startupMigrationLockEnabled: false})
        .STARTUP_MIGRATION_LOCK_ENABLED
    ).toBe('false');
  });

  it('forces the lock off when migrate-on-startup is skipped', () => {
    expect(
      envForMigration({disableMigrateOnStartup: true})
        .STARTUP_MIGRATION_LOCK_ENABLED
    ).toBe('false');
  });
});
