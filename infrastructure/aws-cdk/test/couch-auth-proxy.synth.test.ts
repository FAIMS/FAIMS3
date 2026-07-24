/**
 * Synth-level assertions for mandatory couch-auth-proxy wiring.
 * Uses a minimal stack (no frontend bundling) so CI can verify ALB / env / SG.
 */
import * as cdk from 'aws-cdk-lib';
import {Match, Template} from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {EC2CouchDB} from '../lib/components/couch-db';
import {CouchAuthProxy} from '../lib/components/couch-auth-proxy';
import {FaimsConductor} from '../lib/components/conductor';
import {FaimsNetworking} from '../lib/components/networking';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

function wireMinimalStack(): Template {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'ProxyStack', {
    env: {account: '123456789012', region: 'ap-southeast-2'},
  });

  const hz = route53.HostedZone.fromHostedZoneAttributes(stack, 'hz', {
    hostedZoneId: 'Z1234567890',
    zoneName: 'example.com',
  });
  const cert = acm.Certificate.fromCertificateArn(
    stack,
    'cert',
    'arn:aws:acm:ap-southeast-2:123456789012:certificate/11111111-1111-1111-1111-111111111111'
  );
  const networking = new FaimsNetworking(stack, 'networking', {
    certificate: cert,
  });
  const cookieSecret = new sm.Secret(stack, 'cookie', {
    generateSecretString: {passwordLength: 16, excludePunctuation: true},
  });

  const domainCouch = 'couch.example.com';
  const domainConductor = 'conductor.example.com';

  const couchDb = new EC2CouchDB(stack, 'couch-db', {
    vpc: networking.vpc,
    instanceType: 't3.small',
    certificate: cert,
    domainName: domainCouch,
    hz,
    sharedBalancer: networking.sharedBalancer,
    dataVolumeSize: 20,
    couchVersionTag: '3.3.3',
    cookieSecret,
  });

  const proxy = new CouchAuthProxy(stack, 'couch-auth-proxy', {
    vpc: networking.vpc,
    sharedBalancer: networking.sharedBalancer,
    domainName: domainCouch,
    certificate: cert,
    couchInternalUrl: couchDb.internalEndpoint,
    couchAdminSecret: couchDb.passwordSecret,
    couchSecurityGroup: couchDb.securityGroup,
    corsOrigins: ['https://faims.example.com', 'https://web.example.com'],
    image: 'ghcr.io/peterbaker0/couch-auth-proxy',
    imageTag: 'sha-3004091',
    cpu: 512,
    memory: 1024,
    desiredCount: 2,
    couchInternalPort: couchDb.couchInternalPort,
  });

  const conductor = new FaimsConductor(stack, 'conductor', {
    vpc: networking.vpc,
    certificate: cert,
    domainName: domainConductor,
    privateKeySecretArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk-AbCdEf',
    hz,
    couchDbAdminSecret: couchDb.passwordSecret,
    couchDBPublicEndpoint: proxy.publicEndpoint,
    couchDBInternalEndpoint: couchDb.internalEndpoint,
    couchDBPort: couchDb.exposedPort,
    webAppPublicUrl: 'https://faims.example.com',
    androidAppPublicUrl: 'https://play.google.com/store/apps/details?id=x',
    iosAppPublicUrl: 'https://apps.apple.com/app/x',
    appId: 'FAIMS',
    sharedBalancer: networking.sharedBalancer,
    config: {
      name: 'Test',
      description: 'Test',
      conductorDockerImage: 'ghcr.io/faims/faims3-api',
      conductorDockerImageTag: 'latest',
      shortCodePrefix: 'FAIMS',
      provisionSSOUsersPolicy: 'reject',
      cpu: 512,
      memory: 1024,
      localhostWhitelist: false,
      migrateNotebooksOnStartup: true,
      autoScaling: {
        desiredCapacity: 1,
        minCapacity: 1,
        maxCapacity: 2,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 70,
        scaleInCooldown: 60,
        scaleOutCooldown: 60,
      },
    },
    cookieSecret,
    webUrl: 'https://web.example.com',
    smtpCredsArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:smtp-AbCdEf',
    smtpConfig: {
      emailServiceType: 'SMTP',
      fromEmail: 'notify@example.com',
      fromName: 'FAIMS',
      testEmailAddress: 'admin@example.com',
    },
    localhostWhitelist: false,
  });

  couchDb.securityGroup.connections.allowFrom(
    conductor.serviceSecurityGroup,
    ec2.Port.tcp(couchDb.couchInternalPort),
    'Allow Conductor to CouchDB (internal)'
  );

  return Template.fromStack(stack);
}

describe('couch-auth-proxy CDK wiring (always on)', () => {
  const template = wireMinimalStack();

  it('registers ALB host rule to proxy TG health path, not Couch :5984', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 8000,
      HealthCheckPath: '/_couch-auth-proxy/health',
      Matcher: {HttpCode: '200'},
    });

    const tgs = template.findResources(
      'AWS::ElasticLoadBalancingV2::TargetGroup'
    );
    const couchInstanceTg = Object.values(tgs).filter(
      (tg: {Properties?: {Port?: number; TargetType?: string}}) =>
        tg.Properties?.Port === 5984 && tg.Properties?.TargetType === 'instance'
    );
    expect(couchInstanceTg).toHaveLength(0);
  });

  it('runs proxy Fargate task with hardened ACL env and Secrets Manager admin', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Image: 'ghcr.io/peterbaker0/couch-auth-proxy:sha-3004091',
          Environment: Match.arrayWith([
            {Name: 'ACL_DB_INCLUDE', Value: '/^data-/'},
            {
              Name: 'ACL_ROUTE_INCLUDE',
              Value: 'pouch-sync,session',
            },
            {Name: 'ACL_AUTO_INSTALL', Value: 'false'},
            {
              Name: 'AUTH_RESOLVE_VIA_COUCH_SESSION',
              Value: 'true',
            },
            {
              Name: 'CORS_ORIGINS',
              Value: 'https://faims.example.com,https://web.example.com',
            },
          ]),
          Secrets: Match.arrayWith([
            Match.objectLike({Name: 'COUCH_ADMIN_USER'}),
            Match.objectLike({Name: 'COUCH_ADMIN_PASSWORD'}),
          ]),
        }),
      ]),
    });
  });

  it('sets Conductor PUBLIC vs INTERNAL Couch URLs distinctly', () => {
    const tasks = template.findResources('AWS::ECS::TaskDefinition');
    const conductor = Object.values(tasks).find(
      (td: {
        Properties?: {
          ContainerDefinitions?: Array<{
            Image?: string;
            Environment?: Array<{Name: string; Value: unknown}>;
          }>;
        };
      }) =>
        td.Properties?.ContainerDefinitions?.some(c =>
          c.Image?.includes('faims3-api')
        )
    ) as {
      Properties: {
        ContainerDefinitions: Array<{
          Image?: string;
          Environment?: Array<{Name: string; Value: unknown}>;
        }>;
      };
    };
    const env = conductor.Properties.ContainerDefinitions.find(c =>
      c.Image?.includes('faims3-api')
    )!.Environment!;
    const byName = Object.fromEntries(env.map(e => [e.Name, e.Value]));
    expect(byName.COUCHDB_PUBLIC_URL).toBe('https://couch.example.com:443');
    expect(byName.COUCHDB_INTERNAL_URL).not.toBe(byName.COUCHDB_PUBLIC_URL);
    expect(byName.COUCH_ACL_CLIENT_SCHEMA_VERSION).toBeUndefined();
    const internal = JSON.stringify(byName.COUCHDB_INTERNAL_URL);
    expect(internal).toContain('http://');
    expect(internal).toContain(':5984');
    expect(internal).not.toContain('https://');
  });
});
