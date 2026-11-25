// SPDX-License-Identifier: Apache-2.0

/**
 * Template tests for EC2CouchDB private DNS and instance ingress.
 */
import * as cdk from 'aws-cdk-lib';
import {Match, Template} from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {
  couchInternalHostname,
  couchInternalUrl,
  couchInternalZoneName,
  EC2CouchDB,
} from '../lib/components/couch-db';
import {SharedBalancer} from '../lib/components/networking';

const BASE_DOMAIN = 'example.com';
const COUCH_DOMAIN = `db.${BASE_DOMAIN}`;
const CERT_ARN =
  'arn:aws:acm:ap-southeast-2:123456789012:certificate/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

interface IngressRule {
  description?: string;
  fromPort?: number;
  toPort?: number;
  ipProtocol?: string;
  cidrIp?: string;
  sourceSecurityGroupId?: unknown;
}

function normalizeIngress(properties: Record<string, unknown>): IngressRule {
  return {
    description: properties.Description as string | undefined,
    fromPort: properties.FromPort as number | undefined,
    toPort: properties.ToPort as number | undefined,
    ipProtocol: properties.IpProtocol as string | undefined,
    cidrIp: properties.CidrIp as string | undefined,
    sourceSecurityGroupId: properties.SourceSecurityGroupId,
  };
}

function referencesLogicalId(value: unknown, logicalId: string): boolean {
  return JSON.stringify(value).includes(logicalId);
}

function couchSecurityGroupLogicalId(template: Template): string {
  const groups = template.findResources('AWS::EC2::SecurityGroup');
  const match = Object.entries(groups).find(
    ([, resource]) =>
      resource.Properties.GroupDescription ===
      'Security group for CouchDB EC2 instances'
  );
  if (!match) {
    throw new Error('CouchDB security group not found in template');
  }
  return match[0];
}

function couchIngressRules(template: Template): IngressRule[] {
  const sgLogicalId = couchSecurityGroupLogicalId(template);
  const rules: IngressRule[] = [];
  const groups = template.findResources('AWS::EC2::SecurityGroup');
  const inline = groups[sgLogicalId]?.Properties.SecurityGroupIngress as
    | Array<Record<string, unknown>>
    | undefined;
  for (const rule of inline ?? []) {
    rules.push(normalizeIngress(rule));
  }

  const ingressResources = template.findResources(
    'AWS::EC2::SecurityGroupIngress'
  );
  for (const resource of Object.values(ingressResources)) {
    if (referencesLogicalId(resource.Properties.GroupId, sgLogicalId)) {
      rules.push(normalizeIngress(resource.Properties));
    }
  }
  return rules;
}

function synthCouchStack() {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'CouchDbTestStack', {
    env: {account: '123456789012', region: 'ap-southeast-2'},
  });
  const vpc = new ec2.Vpc(stack, 'vpc', {maxAzs: 2, natGateways: 0});
  const certificate = acm.Certificate.fromCertificateArn(
    stack,
    'cert',
    CERT_ARN
  );
  const hz = route53.HostedZone.fromHostedZoneAttributes(stack, 'hz', {
    hostedZoneId: 'Z1234567890ABC',
    zoneName: BASE_DOMAIN,
  });
  const sharedBalancer = new SharedBalancer(stack, 'shared-balancer', {
    vpc,
    certificates: [certificate],
    isPublic: true,
    subnetType: ec2.SubnetType.PUBLIC,
  });
  const cookieSecret = new sm.Secret(stack, 'cookie', {
    generateSecretString: {passwordLength: 16, excludePunctuation: true},
  });
  const backendSg = new ec2.SecurityGroup(stack, 'conductor-sg', {
    vpc,
    allowAllOutbound: true,
    description: 'Security group for Conductor Fargate service',
  });

  const couchDb = new EC2CouchDB(stack, 'couch-db', {
    vpc,
    domainName: COUCH_DOMAIN,
    baseDomain: BASE_DOMAIN,
    sharedBalancer,
    hz,
    certificate,
    dataVolumeSize: 20,
    instanceType: 't3.small',
    couchVersionTag: '3.3.3',
    cookieSecret,
  });

  couchDb.securityGroup.connections.allowFrom(
    backendSg,
    ec2.Port.tcp(couchDb.internalPort),
    'Allow traffic from Conductor tasks to CouchDB'
  );

  return {stack, couchDb};
}

describe('couch internal DNS helpers', () => {
  it('builds the VPC hostname and HTTP :5984 URL from the base domain', () => {
    expect(couchInternalZoneName(BASE_DOMAIN)).toBe('internal.example.com');
    expect(couchInternalHostname(BASE_DOMAIN)).toBe(
      'couchdb.internal.example.com'
    );
    expect(couchInternalUrl(BASE_DOMAIN)).toBe(
      'http://couchdb.internal.example.com:5984'
    );
  });
});

describe('EC2CouchDB synth', () => {
  const {stack, couchDb} = synthCouchStack();
  const template = Template.fromStack(stack);

  it('exports a VPC HTTP internal URL distinct from the public ALB HTTPS URL', () => {
    expect(couchDb.internalEndpoint).toBe(
      'http://couchdb.internal.example.com:5984'
    );
    expect(couchDb.couchEndpoint).toBe('https://db.example.com:443');
    expect(couchDb.internalEndpoint).not.toBe(couchDb.couchEndpoint);
    expect(couchDb.internalPort).toBe(5984);
    expect(couchDb.exposedPort).toBe(443);
  });

  it('creates a private hosted zone for internal.<baseDomain> associated with the VPC', () => {
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: Match.stringLikeRegexp('internal\\.example\\.com\\.?'),
      VPCs: Match.arrayWith([
        Match.objectLike({
          VPCId: Match.anyValue(),
        }),
      ]),
    });
  });

  it('creates an A record couchdb.internal.<baseDomain> targeting the instance private IP', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: Match.stringLikeRegexp('couchdb\\.internal\\.example\\.com\\.?'),
      Type: 'A',
      ResourceRecords: Match.arrayWith([
        Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('CouchDBInstance'),
            'PrivateIp',
          ]),
        }),
      ]),
    });
  });

  it('allows TCP 5984 from the ALB SG and Conductor task SG only', () => {
    const rules = couchIngressRules(template);
    expect(rules).toHaveLength(2);
    expect(
      rules.every(
        rule =>
          rule.ipProtocol === 'tcp' &&
          rule.fromPort === 5984 &&
          rule.toPort === 5984 &&
          rule.sourceSecurityGroupId !== undefined &&
          rule.cidrIp === undefined
      )
    ).toBe(true);

    const descriptions = rules.map(rule => rule.description);
    expect(descriptions).toEqual(
      expect.arrayContaining([
        'Allow traffic from ALB to CouchDB instances',
        'Allow traffic from Conductor tasks to CouchDB',
      ])
    );
  });

  it('has no 0.0.0.0/0 ingress on 443 or any other port', () => {
    const rules = couchIngressRules(template);
    expect(rules.some(rule => rule.cidrIp === '0.0.0.0/0')).toBe(false);
    expect(rules.some(rule => rule.fromPort === 443)).toBe(false);

    const ingressResources = template.findResources(
      'AWS::EC2::SecurityGroupIngress'
    );
    for (const resource of Object.values(ingressResources)) {
      expect(resource.Properties.CidrIp).not.toBe('0.0.0.0/0');
    }
  });

  it('keeps AmazonSSMManagedInstanceCore on the instance role', () => {
    const roles = template.findResources('AWS::IAM::Role');
    const ssmRoles = Object.values(roles).filter(role =>
      JSON.stringify(role.Properties.ManagedPolicyArns ?? []).includes(
        'AmazonSSMManagedInstanceCore'
      )
    );
    expect(ssmRoles.length).toBeGreaterThan(0);
  });
});
