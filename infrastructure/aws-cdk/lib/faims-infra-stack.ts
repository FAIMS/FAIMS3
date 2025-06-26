import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {BackupConstruct} from './components/backups';
import {Construct} from 'constructs';
import {FaimsConductor} from './components/conductor';
import {FaimsFrontEnd} from './components/front-end';
import {FaimsNetworking} from './components/networking';
import {EC2CouchDB} from './components/couch-db';
import {Config} from './config';

/**
 * Properties for the FaimsInfraStack
 */
export interface FaimsInfraStackProps extends cdk.StackProps {
  config: Config;
}

/**
 * Main infrastructure stack for the FAIMS application
 */
export class FaimsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FaimsInfraStackProps) {
    super(scope, id, props);

    // Pull out main config
    const config = props.config;

    // DNS SETUP
    // =========

    // Setup the hosted zone for domain definitions
    const hz = route53.HostedZone.fromHostedZoneAttributes(this, 'hz', {
      hostedZoneId: config.hostedZone.id,
      zoneName: config.hostedZone.name,
    });

    // Domain configurations
    const domains = {
      couch: `${config.domains.couch}.${config.domains.baseDomain}`,
      conductor: `${config.domains.conductor}.${config.domains.baseDomain}`,
      faims: `${config.domains.faims}.${config.domains.baseDomain}`,
      web: `${config.domains.web}.${config.domains.baseDomain}`,
    };

    // BACKUPS SETUP
    // =============
    if (!(config.backup.vaultArn || config.backup.vaultName)) {
      throw Error(
        'Must provide either an existing Backup vault ARN or a vault name to create.'
      );
    }
    const backups = new BackupConstruct(this, 'backup', config.backup);

    // CERTIFICATES
    // ============

    // Primary certificate for the hosted zone
    const primaryCert = acm.Certificate.fromCertificateArn(
      this,
      'primary-cert',
      config.certificates.primary
    );

    // CloudFront certificate
    const cfnCert = acm.Certificate.fromCertificateArn(
      this,
      'cfn-cert',
      config.certificates.cloudfront
    );

    // NETWORKING
    // ==========

    // Setup networking infrastructure
    const networking = new FaimsNetworking(this, 'networking', {
      certificate: primaryCert,
    });

    // Cookie secret shared between couch and conductor

    // Generate cookie auth secret at deploy time
    const cookieSecret = new sm.Secret(this, 'conductor-cookie-secret', {
      description:
        'Contains a randomly generated string used for cookie auth in conductor and couch',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        includeSpace: false,
        passwordLength: 25,
        excludePunctuation: true,
      },
    });

    // COUCHDB
    // =======

    // Create a single EC2 cluster which runs CouchDB
    const couchDb = new EC2CouchDB(this, 'couch-db', {
      vpc: networking.vpc,
      instanceType: config.couch.instanceType,
      certificate: primaryCert,
      domainName: domains.couch,
      hz: hz,
      sharedBalancer: networking.sharedBalancer,
      dataVolumeSize: config.couch.volumeSize,
      dataVolumeSnapshotId: config.couch.ebsRecoverySnapshotId,
      monitoring: config.couch.monitoring,
      couchVersionTag: config.couch.couchVersionTag,
      cookieSecret: cookieSecret,
    });

    // CONDUCTOR
    // =========

    // Deploy the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, 'conductor', {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: domains.conductor,
      privateKeySecretArn: config.secrets.privateKey,
      hz: hz,
      maximumLongLivedDurationDays:
        config.security.maximumLongLivedTokenDurationDays,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${domains.faims}`,
      androidAppPublicUrl: config.mobileApps.androidAppPublicUrl,
      iosAppPublicUrl: config.mobileApps.iosAppPublicUrl,
      appId: config.uiConfiguration.appId,
      sharedBalancer: networking.sharedBalancer,
      config: config.conductor,
      cookieSecret: cookieSecret,
      webUrl: `https://${domains.web}`,
      // Add SMTP configuration
      smtpCredsArn: config.smtp.credentialsSecretArn,
      smtpConfig: {
        emailServiceType: config.smtp.emailServiceType,
        fromEmail: config.smtp.fromEmail,
        fromName: config.smtp.fromName,
        replyTo: config.smtp.replyTo,
        testEmailAddress: config.smtp.testEmailAddress,
        cacheExpirySeconds: config.smtp.cacheExpirySeconds,
      },
      socialProviders: config.socialProviders,
      localhostWhitelist: config.conductor.localhostWhitelist,
    });

    // FRONT-END
    // =========

    // Deploy the FAIMS 3 web front-end as a S3 CloudFront static website
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _frontEnd = new FaimsFrontEnd(this, 'frontend', {
      couchDbDomainOnly: domains.couch,
      couchDbPort: couchDb.exposedPort,
      faimsDomainNames: [domains.faims],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
      uiTheme: config.uiConfiguration.uiTheme,
      notebookListType: config.uiConfiguration.notebookListType,
      notebookName: config.uiConfiguration.notebookName,
      appName: config.uiConfiguration.appName,
      appId: config.uiConfiguration.appId,
      headingAppName: config.uiConfiguration.headingAppName,
      webDomainName: domains.web,
      offlineMaps: config.uiConfiguration.offlineMaps,
      supportEmail: config.supportLinks.supportEmail,
      privacyPolicyUrl: config.supportLinks.privacyPolicyUrl,
      contactUrl: config.supportLinks.contactUrl,
      maximumLongLivedDurationDays:
        config.security.maximumLongLivedTokenDurationDays,
    });

    // Backup setup
    backups.registerEbsVolume(couchDb.dataVolume, 'couchDbDataVolume');
  }
}
