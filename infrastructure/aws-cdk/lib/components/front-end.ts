import {Construct} from 'constructs';
import {StaticWebsite} from '@cloudcomponents/cdk-static-website';
import {
  AssetHashType,
  CfnOutput,
  Duration,
  RemovalPolicy,
  aws_lambda,
  aws_s3,
  aws_s3_deployment,
} from 'aws-cdk-lib';
import {Source} from 'aws-cdk-lib/aws-s3-deployment';
import {IDistribution} from 'aws-cdk-lib/aws-cloudfront';
import {IHostedZone} from 'aws-cdk-lib/aws-route53';
import {ICertificate} from 'aws-cdk-lib/aws-certificatemanager';
import {getPathHash, getPathToRoot} from '../util/mono';
import {OfflineMapsConfig} from '../config';

const MAP_ORIGINS_SHARED = [
  'openmaptiles.github.io',
  'api.maptiler.com',
  '*.openstreetmap.org',
];

export interface FaimsFrontEndProps {
  // FAIMS main website

  // The HZ to produce record in
  faimsHz: IHostedZone;
  // The DNS cert to use for domain LB (needs to be us-east-1)
  faimsUsEast1Certificate: ICertificate;
  // Domain name
  faimsDomainNames: Array<string>;

  // customisation
  uiTheme: 'bubble' | 'default' | 'bssTheme';
  notebookListType: 'tabs' | 'headings';
  notebookName: string;
  // App display name
  appName: string;
  // Top banner to display - defaults to appName
  headingAppName?: string;
  // Used for mobile app builds etc
  appId: string;

  // support links
  supportEmail: string;
  privacyPolicyUrl: string;
  contactUrl: string;

  // e.g. db.domain.com
  couchDbDomainOnly: string;
  // e.g. 443
  couchDbPort: number;

  // conductor e.g. https://api.com
  conductorUrl: string;

  // web config
  webDomainName: string;

  // Enable debugging settings @default false
  debugMode?: boolean;

  // Offline maps settings -> env variables in faims
  offlineMaps: OfflineMapsConfig;

  /** Maximum long-lived token duration in days (undefined = infinite) */
  maximumLongLivedDurationDays?: number;

  /** Bugsnag key - enables app monitoring if desired */
  bugsnagKey?: string;
  /** Bugsnag app version - tags the app version in bug snag */
  appVersion?: string;
}

export class FaimsFrontEnd extends Construct {
  faimsBucket: aws_s3.IBucket;
  faimsDistribution: IDistribution;
  faimsBucketArnCfnOutput: CfnOutput;
  faimsBucketNameCfnOutput: CfnOutput;

  webBucket: aws_s3.IBucket;
  webDistribution: IDistribution;
  webBucketArnCfnOutput: CfnOutput;
  webBucketNameCfnOutput: CfnOutput;

  private debugMode: boolean;

  // derived property
  faimsAppUrl: string;

  constructor(scope: Construct, id: string, props: FaimsFrontEndProps) {
    super(scope, id);

    // Debug mode
    this.debugMode = props.debugMode ?? false;

    // use the first domain name to form canonical URL
    this.faimsAppUrl = `https://${props.faimsDomainNames[0]}`;

    // Main Faims frontend
    this.deployFaims(props);

    // Web deployment
    this.deployWeb(props);
  }

  deployFaims(props: FaimsFrontEndProps) {
    // setup distribution and static bucket hosting
    this.setupFaimsDistribution(props);

    // Deploy into this bucket
    this.setupFaimsBundling(props);

    // Bucket arn
    this.faimsBucketArnCfnOutput = new CfnOutput(this, 'FaimsBucketArn', {
      value: this.faimsBucket.bucketArn,
      description:
        'The ARN of S3 bucket used to deploy the website static contents.',
    });

    // Bucket name
    this.faimsBucketNameCfnOutput = new CfnOutput(this, 'FaimsBucketName', {
      value: this.faimsBucket.bucketName,
      description:
        'The name of S3 bucket used to deploy the website static contents.',
    });
  }

  setupFaimsDistribution(props: FaimsFrontEndProps) {
    // this allows connections to various map services supported as well as the
    // API and couch domains
    const csp =
      `connect-src 'self' https://${props.couchDbDomainOnly} ${props.conductorUrl} *.bugsnag.com ` +
      MAP_ORIGINS_SHARED.join(' ');

    const website = new StaticWebsite(this, 'faims-website', {
      hostedZone: props.faimsHz,
      domainNames: props.faimsDomainNames,
      removalPolicy: RemovalPolicy.DESTROY,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: '/index.html',
        },
        // 403 should go 200 to index.html so that react router can work!
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: '/index.html',
        },
      ],
      certificate: props.faimsUsEast1Certificate,

      // TODO dig into this more to make it more secure - just getting it working for now
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          // enable connection to the couch db URL
          contentSecurityPolicy: csp,
          override: true,
        },
      },
    });

    this.faimsBucket = website.bucket;
    this.faimsDistribution = website.distribution;
  }

  setupFaimsBundling(props: FaimsFrontEndProps) {
    // const buildScript = 'build.sh';
    // need to build from root because requires context in docker bundling from
    // monorepo root
    // TODO consider approaches here to improve build time and
    // hashing
    const buildPath = getPathToRoot();
    const appPath = 'app';
    const outputPath = 'build';

    const environment: {[key: string]: string} = {
      platform: 'web',
      serverprefix: 'fieldmark',
      VITE_CLUSTER_ADMIN_GROUP_NAME: 'cluster-admin',
      // It's optional to provide this
      // VITE_COMMIT_VERSION: 'unknown TBD',

      // Debugging has performance implications
      VITE_DEBUG_APP: this.debugMode ? 'true' : 'false',
      VITE_DEBUG_POUCHDB: this.debugMode ? 'true' : 'false',
      VITE_SHOW_WIPE: 'true',
      VITE_SHOW_NEW_NOTEBOOK: 'true',
      VITE_SHOW_POUCHDB_BROWSER: 'true',
      VITE_APP_NAME: props.appName,
      VITE_APP_ID: props.appId,
      VITE_HEADING_APP_NAME: props.headingAppName ?? props.appName,
      VITE_SUPPORT_EMAIL: props.supportEmail,
      VITE_APP_PRIVACY_POLICY_URL: props.privacyPolicyUrl,
      VITE_APP_CONTACT_URL: props.contactUrl,

      // Theme: default or bubble
      VITE_THEME: props.uiTheme,
      // tabs or headings
      VITE_NOTEBOOK_LIST_TYPE: props.notebookListType,
      // e.g. survey, notebook
      VITE_NOTEBOOK_NAME: props.notebookName,
      // Include record summary counts
      VITE_SHOW_RECORD_SUMMARY_COUNTS: 'true',
      // Conductor API URL
      VITE_CONDUCTOR_URL: props.conductorUrl,
      VITE_TAG: 'CDKDeployment',

      // offline maps configuration
      VITE_MAP_SOURCE: props.offlineMaps.mapSource,
      VITE_OFFLINE_MAPS: props.offlineMaps.offlineMaps ? 'true' : 'false',
      VITE_MAP_STYLE: props.offlineMaps.mapStyle,
      ...(props.offlineMaps.mapSourceKey
        ? {VITE_MAP_SOURCE_KEY: props.offlineMaps.mapSourceKey}
        : {}),
      ...(props.offlineMaps.satelliteSource
        ? {VITE_SATELLITE_SOURCE: props.offlineMaps.satelliteSource}
        : {}),

      // Monitoring
      ...(props.bugsnagKey ? {VITE_BUGSNAG_KEY: props.bugsnagKey} : {}),
    };

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, 'deploy', {
      destinationBucket: this.faimsBucket,
      // Setup with distribution so that the deployment will invalidate
      // distribution cache when the files are redeployed
      distribution: this.faimsDistribution,
      distributionPaths: ['/*'],
      sources: [
        Source.asset(buildPath, {
          // TODO optimise
          exclude: ['infrastructure'],
          // Hash the app folder source files only
          assetHash: getPathHash(`${getPathToRoot()}/${appPath}`, [outputPath]),
          assetHashType: AssetHashType.CUSTOM,

          bundling: {
            // Include env variables for bundling
            environment,
            // Use node image for non local bundling
            image: aws_lambda.Runtime.NODEJS_20_X.bundlingImage,
            // Docker build expects input/output of asset-input/output
            command: [
              'bash',
              '-c',
              `
            cd /asset-input && pnpm i && pnpm run github-build-app && cd ${appPath} && cp -R ${outputPath}/* /asset-output
            `,
            ],
            // Local bundling is faster for quick local deploy
            local: {
              tryBundle(outputDir: string) {
                // Implement the logic to check if Docker is available
                console.log('Trying local bundling of build files.');

                // Build list of export commands
                const envs = Object.keys(environment)
                  .map(key => {
                    return `export ${key}="${environment[key] as string}"`;
                  })
                  .join(' && ');

                // Perform the same bundling operations performed in the Docker container
                const exec = require('child_process').execSync;
                const commands = [
                  //export environment variables - not included by default
                  envs,
                  `cd ${buildPath}`,
                  'pnpm i && pnpm run github-build-app',
                  `cd ${appPath}`,
                  `cp -R ${outputPath}/* ${outputDir}`,
                ];
                console.log(commands);
                exec(commands.join('&& '), {stdio: 'inherit'});
                // Return true because bundling is complete
                return true;
              },
            },
          },
        }),
      ],
    });
  }

  deployWeb(props: FaimsFrontEndProps) {
    // setup distribution and static bucket hosting
    this.setupWebDistribution(props);

    // Deploy into this bucket
    this.setupWebBundling(props);

    // Bucket arn
    this.webBucketArnCfnOutput = new CfnOutput(this, 'WebBucketArn', {
      value: this.webBucket.bucketArn,
      description:
        'The ARN of S3 bucket used to deploy the website static contents.',
    });

    // Bucket name
    this.webBucketNameCfnOutput = new CfnOutput(this, 'WebBucketName', {
      value: this.webBucket.bucketName,
      description:
        'The name of S3 bucket used to deploy the website static contents.',
    });
  }

  setupWebDistribution(props: FaimsFrontEndProps) {
    const website = new StaticWebsite(this, 'web-website', {
      hostedZone: props.faimsHz,
      domainNames: [props.webDomainName],
      removalPolicy: RemovalPolicy.DESTROY,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: '/index.html',
        },
      ],
      certificate: props.faimsUsEast1Certificate,
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          // enable connection to the API URL
          contentSecurityPolicy: `connect-src 'self' ${props.conductorUrl}`,
          override: true,
        },
      },
    });

    this.webBucket = website.bucket;
    this.webDistribution = website.distribution;
  }

  setupWebBundling(props: FaimsFrontEndProps) {
    const buildPath = getPathToRoot();
    const appPath = 'web';
    const outputPath = 'dist';

    const environment: {[key: string]: string} = {
      VITE_WEB_URL: `https://${props.webDomainName}`,
      VITE_API_URL: props.conductorUrl,
      VITE_APP_NAME: props.appName,
      VITE_APP_SHORT_NAME: props.headingAppName ?? props.appName,
      // FAIMS /app URL (uses first domain if multiple provided)
      VITE_APP_URL: this.faimsAppUrl,
      VITE_NOTEBOOK_NAME: props.notebookName,
      VITE_THEME: props.uiTheme,
      VITE_WEBSITE_TITLE: 'Control Centre',
      // Maps setup for web
      VITE_MAP_SOURCE: props.offlineMaps.mapSource,
      VITE_MAP_STYLE: props.offlineMaps.mapStyle,
      ...(props.offlineMaps.mapSourceKey
        ? {VITE_MAP_SOURCE_KEY: props.offlineMaps.mapSourceKey}
        : {}),
      ...(props.offlineMaps.satelliteSource
        ? {VITE_SATELLITE_SOURCE: props.offlineMaps.satelliteSource}
        : {}),
      VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS:
        props.maximumLongLivedDurationDays?.toString() ?? 'infinite',
      // Monitoring
      ...(props.bugsnagKey ? {VITE_BUGSNAG_API_KEY: props.bugsnagKey} : {}),
      // Prefer using the package.json version - but allow overriding
      ...(props.appVersion ? {VITE_APP_VERSION: props.appVersion} : {}),
    };

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, 'web-deploy', {
      destinationBucket: this.webBucket,
      // Setup with distribution so that the deployment will invalidate
      // distribution cache when the files are redeployed
      distribution: this.webDistribution,
      distributionPaths: ['/*'],
      sources: [
        Source.asset(buildPath, {
          // TODO optimise
          exclude: ['infrastructure'],
          // Hash the app folder source files only
          assetHash: getPathHash(`${getPathToRoot()}/${appPath}`, [outputPath]),
          assetHashType: AssetHashType.CUSTOM,

          bundling: {
            // Include env variables for bundling
            environment,
            // Use node image for non local bundling
            image: aws_lambda.Runtime.NODEJS_20_X.bundlingImage,
            // Docker build expects input/output of asset-input/output
            command: [
              'bash',
              '-c',
              `
            cd /asset-input && pnpm i && pnpm run build-web && cd ${appPath} && cp -R ${outputPath}/* /asset-output
            `,
            ],
            // Local bundling is faster for quick local deploy
            local: {
              tryBundle(outputDir: string) {
                // Implement the logic to check if Docker is available
                console.log('Trying local bundling of build files.');

                // Build list of export commands
                const envs = Object.keys(environment)
                  .map(key => {
                    return `export ${key}="${environment[key] as string}"`;
                  })
                  .join(' && ');

                // Perform the same bundling operations performed in the Docker container
                const exec = require('child_process').execSync;
                const commands = [
                  //export environment variables - not included by default
                  envs,
                  `cd ${buildPath}`,
                  'pnpm i && pnpm run build-web',
                  `cd ${appPath}`,
                  `cp -R ${outputPath}/* ${outputDir}`,
                ];
                console.log(commands);
                exec(commands.join('&& '), {stdio: 'inherit'});
                // Return true because bundling is complete
                return true;
              },
            },
          },
        }),
      ],
    });
  }
}
