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
import {FaimsTtlCleanup} from './components/ttl-cleanup';
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
      hostedZoneId: config.aws.hostedZone.id,
      zoneName: config.aws.hostedZone.name,
    });

    // Domain configurations
    const domains = {
      couch: `${config.aws.domains.couch}.${config.aws.domains.baseDomain}`,
      conductor: `${config.aws.domains.conductor}.${config.aws.domains.baseDomain}`,
      faims: `${config.aws.domains.faims}.${config.aws.domains.baseDomain}`,
      web: `${config.aws.domains.web}.${config.aws.domains.baseDomain}`,
      docs: `${config.aws.domains.docs}.${config.aws.domains.baseDomain}`,
    };

    // BACKUPS SETUP
    // =============
    if (!(config.aws.backup.vaultArn || config.aws.backup.vaultName)) {
      throw Error(
        'Must provide either an existing Backup vault ARN or a vault name to create.'
      );
    }
    const backups = new BackupConstruct(this, 'backup', config.aws.backup);

    // CERTIFICATES
    // ============

    // Primary certificate for the hosted zone
    const primaryCert = acm.Certificate.fromCertificateArn(
      this,
      'primary-cert',
      config.aws.certificates.primary
    );

    // CloudFront certificate
    const cfnCert = acm.Certificate.fromCertificateArn(
      this,
      'cfn-cert',
      config.aws.certificates.cloudfront
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
      instanceType: config.aws.couch.instanceType,
      certificate: primaryCert,
      domainName: domains.couch,
      hz: hz,
      sharedBalancer: networking.sharedBalancer,
      dataVolumeSize: config.aws.couch.volumeSize,
      dataVolumeSnapshotId: config.aws.couch.ebsRecoverySnapshotId,
      monitoring: config.aws.couch.monitoring,
      couchVersionTag: config.aws.couch.couchVersionTag,
      cookieSecret: cookieSecret,
    });

    // CONDUCTOR
    // =========

    // Deploy the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, 'conductor', {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: domains.conductor,
      privateKeySecretArn: config.aws.secrets.privateKey,
      hz: hz,
      maximumLongLivedDurationDays:
        config.core.authTokens.maximumLongLivedDurationDays,
      rateLimiterEnabled: config.core.limits.rateLimiterEnabled,
      authAttemptLimiterEnabled: config.core.limits.attemptLimiterEnabled,
      exportRateLimiterEnabled: config.core.limits.exportRateLimiterEnabled,
      exportRateLimiterWindowMs: config.core.limits.exportRateLimiterWindowMs,
      exportRateLimiterPerWindow: config.core.limits.exportRateLimiterPerWindow,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${domains.faims}`,
      androidAppPublicUrl: config.core.endpoints.androidAppPublicUrl,
      iosAppPublicUrl: config.core.endpoints.iosAppPublicUrl,
      appId: config.core.android.appId,
      sharedBalancer: networking.sharedBalancer,
      config: config.aws.conductor,
      coreConfig: config.core,
      cookieSecret: cookieSecret,
      webUrl: `https://${domains.web}`,
      // Add SMTP configuration
      smtpCredsArn: config.aws.smtpCredentialsSecretArn,
      smtpConfig: {
        emailServiceType: config.core.email.emailServiceType,
        fromEmail: config.core.email.emailFromAddress,
        fromName: config.core.email.emailFromName,
        replyTo: config.core.email.emailReplyTo,
        testEmailAddress: config.core.email.testEmailAddress,
        cacheExpirySeconds: config.core.email.smtpCacheExpirySeconds,
      },
      authProviders: config.aws.authProviders,
      localhostWhitelist: config.aws.conductor.localhostWhitelist,
      bugsnagApiKey: config.core.observability.bugsnagApiKey,
    });

    // TTL CLEANUP (scheduled one-shot; not in-process cron)
    // =====================================================
    // Deploy API image with ttlCleanup before enabling in an environment.
    if (config.aws.ttlCleanup.enabled) {
      new FaimsTtlCleanup(this, 'ttl-cleanup', {
        vpc: networking.vpc,
        cluster: conductor.cluster,
        securityGroups: [conductor.serviceSecurityGroup],
        containerImage: conductor.containerImage,
        environment: conductor.environment,
        secrets: conductor.secrets,
        privateKeySecretArn: config.aws.secrets.privateKey,
        config: config.aws.ttlCleanup,
        // Same ops SNS/email as CouchDB monitoring alarms.
        alarmTopic: couchDb.alarmSNSTopic,
      });
    }

    // FRONT-END
    // =========

    // Deploy the FAIMS 3 web front-end (app, web, docs) as S3 + CloudFront static websites
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _frontEnd = new FaimsFrontEnd(this, 'frontend', {
      couchDbDomainOnly: domains.couch,
      couchDbPort: couchDb.exposedPort,
      faimsDomainNames: [domains.faims],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
      uiTheme: config.core.branding.theme,
      notebookListType: config.core.notebookAndRecordUX.notebookListType,
      notebookName: config.core.notebookAndRecordUX.notebookName,
      appName: config.core.branding.appName,
      appId: config.core.android.appId,
      headingAppName: config.core.branding.headingAppName,
      webDomainName: domains.web,
      docsDomainName: domains.docs,
      managementWebsiteTitle: config.core.branding.websiteTitle,
      androidAppPublicUrl: config.core.endpoints.androidAppPublicUrl,
      iosAppPublicUrl: config.core.endpoints.iosAppPublicUrl,
      maps: config.core.maps,
      supportEmail: config.core.support.supportEmail,
      privacyPolicyUrl: config.core.support.privacyPolicyUrl,
      contactUrl: config.core.support.appContactUrl,
      docsUrl: config.core.support.docsUrl,
      maximumLongLivedDurationDays:
        config.core.authTokens.maximumLongLivedDurationDays,
      bugsnagKey: config.core.observability.bugsnagApiKey,
      forceRemoteDeletion: config.core.sync.forceRemoteDeletion,
      deleteOnDeactivation: config.core.sync.deleteOnDeactivation,
      excludedTeamRoles: config.core.teamAndRolePolicy.excludedTeamRoles,
      enablePlansInDesigner: config.core.webDesignerLimits.enablePlansInDesigner,
      showStatusTab: config.core.notebookAndRecordUX.showStatusTab,
    });

    // Backup setup
    backups.registerEbsVolume(couchDb.dataVolume, 'couchDbDataVolume');
  }
}
