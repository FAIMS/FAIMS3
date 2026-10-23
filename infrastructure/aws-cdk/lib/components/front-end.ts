import {Construct} from 'constructs';
import {StaticWebsite} from '@cloudcomponents/cdk-static-website';
import {
  AssetHashType,
  CfnOutput,
  Duration,
  DockerImage,
  RemovalPolicy,
  aws_lambda,
  aws_s3,
  aws_s3_deployment,
} from 'aws-cdk-lib';
import {Source} from 'aws-cdk-lib/aws-s3-deployment';
import {IDistribution} from 'aws-cdk-lib/aws-cloudfront';
import {IHostedZone} from 'aws-cdk-lib/aws-route53';
import {ICertificate} from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import {getPathHash, getPathToRoot} from '../util/mono';
import {
  buildEnvMapFromRuntime,
  type EnvValue,
  type RuntimeConfig,
} from '@faims3/build-config';

/**
 * Convert a build-config env value to the string the static-site build env
 * expects. Arrays become CSV; booleans become 'true'/'false'; numbers are
 * stringified. Undefined/null return undefined (the key is omitted).
 */
function envValueToString(value: EnvValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

const MAP_ORIGINS_SHARED = [
  'openmaptiles.github.io',
  'api.maptiler.com',
  'api.mapbox.com',
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

  /** The shared core config - the shared VITE_* env (branding, maps, autosuggest,
   * support, sync, token settings, etc.) is generated from here via
   * buildEnvMapFromRuntime(core, 'apps'). */
  coreConfig: RuntimeConfig;

  // e.g. db.domain.com
  couchDbDomainOnly: string;
  // e.g. 443
  couchDbPort: number;

  // conductor e.g. https://api.com (resolved by the CDK from the domains)
  conductorUrl: string;

  // web config (resolved by the CDK from the domains)
  webDomainName: string;

  // docs config (Sphinx user docs site, resolved by the CDK)
  docsDomainName: string;
  /** Mobile app store URLs for docs variable substitution */
  androidAppPublicUrl: string;
  iosAppPublicUrl: string;

  // Enable debugging settings @default false
  debugMode?: boolean;
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

  docsBucket: aws_s3.IBucket;
  docsDistribution: IDistribution;
  docsBucketArnCfnOutput: CfnOutput;
  docsBucketNameCfnOutput: CfnOutput;

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

    // Documentation site (Sphinx user docs)
    this.deployDocs(props);
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
    // connect-src covers fetch/XHR. `blob:` is a scheme source (CSP cannot
    // origin-scope it; 'self' does not match blob:). Required so TakePhoto
    // gallery-add can fetch Capacitor's URL.createObjectURL(file) on web.
    const csp =
      `connect-src 'self' blob: https://${props.couchDbDomainOnly} ${props.conductorUrl} *.bugsnag.com ` +
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

    // The shared VITE_* env (branding, maps, autosuggest, sync, token
    // settings, etc.) comes from build-config's contract via
    // buildEnvMapFromRuntime(core, 'apps') - the same contract the app/web use
    // to parse their env. Only the resolved URLs, build flags
    // and debug mode are overlaid here (AWS-specific).
    const environment: {[key: string]: string} = {};
    for (const [key, value] of Object.entries(
      buildEnvMapFromRuntime(props.coreConfig, 'apps')
    )) {
      const str = envValueToString(value);
      if (str !== undefined) environment[key] = str;
    }
    environment.platform = 'web';
    environment.serverprefix = 'fieldmark';
    environment.VITE_CLUSTER_ADMIN_GROUP_NAME = 'cluster-admin';
    environment.VITE_SHOW_NEW_NOTEBOOK = 'true';
    environment.VITE_SHOW_RECORD_SUMMARY_COUNTS = 'true';
    // Conductor URL is resolved by the CDK from the deployed domains.
    environment.VITE_CONDUCTOR_URL = props.conductorUrl;
    // Debugging has performance implications.
    environment.VITE_DEBUG_APP = this.debugMode ? 'true' : 'false';
    environment.VITE_DEBUG_POUCHDB = this.debugMode ? 'true' : 'false';

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, 'deploy', {
      destinationBucket: this.faimsBucket,
      // increase memory limit to 2GB for the lambda s3 sync - increases
      // performance
      memoryLimit: 2048,
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
    const csp =
      `connect-src 'self' ${props.conductorUrl} *.bugsnag.com ` +
      MAP_ORIGINS_SHARED.join(' ');

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
          // enable connection to the API URL and map tile services
          contentSecurityPolicy: csp,
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

    // Shared VITE_* env from build-config's contract; overlay the resolved
    // URLs (web/app/api) which are AWS-specific.
    const environment: {[key: string]: string} = {};
    for (const [key, value] of Object.entries(
      buildEnvMapFromRuntime(props.coreConfig, 'apps')
    )) {
      const str = envValueToString(value);
      if (str !== undefined) environment[key] = str;
    }
    environment.VITE_WEB_URL = `https://${props.webDomainName}`;
    environment.VITE_API_URL = props.conductorUrl;
    // FAIMS /app URL (uses first domain if multiple provided)
    environment.VITE_APP_URL = this.faimsAppUrl;

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, 'web-deploy', {
      destinationBucket: this.webBucket,
      // increase memory limit to 2GB for the lambda s3 sync - increases
      // performance
      memoryLimit: 2048,
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

  deployDocs(props: FaimsFrontEndProps) {
    this.setupDocsDistribution(props);
    this.setupDocsBundling(props);

    this.docsBucketArnCfnOutput = new CfnOutput(this, 'DocsBucketArn', {
      value: this.docsBucket.bucketArn,
      description:
        'The ARN of S3 bucket used to deploy the documentation site.',
    });

    this.docsBucketNameCfnOutput = new CfnOutput(this, 'DocsBucketName', {
      value: this.docsBucket.bucketName,
      description:
        'The name of S3 bucket used to deploy the documentation site.',
    });
  }

  setupDocsDistribution(props: FaimsFrontEndProps) {
    const csp =
      "default-src 'self'; font-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

    const website = new StaticWebsite(this, 'docs-website', {
      hostedZone: props.faimsHz,
      domainNames: [props.docsDomainName],
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
          contentSecurityPolicy: csp,
          override: true,
        },
      },
    });

    this.docsBucket = website.bucket;
    this.docsDistribution = website.distribution;
  }

  setupDocsBundling(props: FaimsFrontEndProps) {
    const rootPath = path.resolve(process.cwd(), getPathToRoot());
    const docsPath = path.join(rootPath, 'docs');

    // Shared VITE_* env from build-config's contract; overlay the resolved
    // URLs + the mobile store URLs (docs variable substitution) + the
    // default theme (other themes not yet implemented for docs).
    const docsEnv: {[key: string]: string} = {};
    for (const [key, value] of Object.entries(
      buildEnvMapFromRuntime(props.coreConfig, 'apps')
    )) {
      const str = envValueToString(value);
      if (str !== undefined) docsEnv[key] = str;
    }
    docsEnv.VITE_API_URL = props.conductorUrl;
    docsEnv.VITE_APP_URL = this.faimsAppUrl;
    docsEnv.VITE_WEB_URL = `https://${props.webDomainName}`;
    // Uses default for now, as other themes are not implemented properly
    docsEnv.VITE_THEME = 'default';
    docsEnv.ANDROID_APP_PUBLIC_URL = props.androidAppPublicUrl;
    docsEnv.IOS_APP_PUBLIC_URL = props.iosAppPublicUrl;

    const sphinxImage = DockerImage.fromBuild(docsPath, {
      file: 'Dockerfile',
    });

    new aws_s3_deployment.BucketDeployment(this, 'docs-deploy', {
      destinationBucket: this.docsBucket,
      // increase memory limit to 2GB for the lambda s3 sync - increases
      // performance
      memoryLimit: 2048,
      distribution: this.docsDistribution,
      distributionPaths: ['/*'],
      sources: [
        Source.asset(docsPath, {
          exclude: [
            'user/_build',
            'user/build',
            'developer/docs/build',
            '.env',
          ],
          assetHash: getPathHash(path.join(rootPath, 'docs'), [
            'user/_build',
            'user/build',
            'developer/docs/build',
          ]),
          assetHashType: AssetHashType.CUSTOM,
          bundling: {
            image: sphinxImage,
            environment: docsEnv,
            command: [
              'bash',
              '-c',
              [
                'set -e',
                "echo '[docs build] Starting...'",
                "echo '[docs build] Source in /asset-input/user:' && find /asset-input/user -type f | wc -l && ls -la /asset-input/user",
                'mkdir -p /tmp/sphinx-build',
                'cp -r /asset-input/user/. /tmp/sphinx-build/',
                "echo '[docs build] Copied to /tmp/sphinx-build:' && find /tmp/sphinx-build -type f | wc -l",
                'cd /tmp/sphinx-build',
                "echo '[docs build] Running sphinx-build...'",
                'sphinx-build -b html . _build/html',
                "echo '[docs build] Sphinx done. HTML files:' && find _build/html -type f | wc -l && ls _build/html",
                'cp -r _build/html/* /asset-output/',
                "echo '[docs build] Asset output:' && find /asset-output -type f | wc -l && ls -la /asset-output",
              ].join(' && '),
            ],
          },
        }),
      ],
    });
  }
}
