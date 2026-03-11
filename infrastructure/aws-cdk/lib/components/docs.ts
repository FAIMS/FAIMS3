import {Construct} from 'constructs';
import {StaticWebsite} from '@cloudcomponents/cdk-static-website';
import {
  AssetHashType,
  CfnOutput,
  Duration,
  RemovalPolicy,
  DockerImage,
  aws_s3,
  aws_s3_deployment,
} from 'aws-cdk-lib';
import {Source} from 'aws-cdk-lib/aws-s3-deployment';
import {IDistribution} from 'aws-cdk-lib/aws-cloudfront';
import {IHostedZone} from 'aws-cdk-lib/aws-route53';
import {ICertificate} from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import {getPathHash, getPathToRoot} from '../util/mono';

export interface FaimsDocsProps {
  /** Hosted zone for the docs domain */
  hostedZone: IHostedZone;
  /** Certificate for CloudFront (must be us-east-1) */
  certificate: ICertificate;
  /** Domain name for the docs site (e.g. docs.example.com) */
  domainName: string;

  /** App name (used in docs as VITE_APP_NAME) */
  appName: string;
  /** Notebook name (e.g. survey, notebook) */
  notebookName: string;
  /** Website title for the management app */
  managementWebsiteTitle: string;
  /** UI theme (e.g. default, bssTheme) - used for doc variable substitution */
  theme: string;
  /** Conductor API URL */
  apiUrl: string;
  /** Main app URL */
  appUrl: string;
  /** Web/dashboard URL */
  webUrl: string;
  /** Android app store URL */
  androidAppPublicUrl: string;
  /** iOS app store URL */
  iosAppPublicUrl: string;
}

/**
 * Static documentation site built with Sphinx (user docs) and deployed to S3 + CloudFront.
 * Uses CDK Docker bundling with the docs/Dockerfile image to run the Sphinx build.
 */
export class FaimsDocs extends Construct {
  readonly bucket: aws_s3.IBucket;
  readonly distribution: IDistribution;
  readonly bucketArnCfnOutput: CfnOutput;
  readonly bucketNameCfnOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: FaimsDocsProps) {
    super(scope, id);

    const {bucket, distribution} = this.setupDistribution(props);
    this.bucket = bucket;
    this.distribution = distribution;
    this.setupBundling(props);

    this.bucketArnCfnOutput = new CfnOutput(this, 'DocsBucketArn', {
      value: this.bucket.bucketArn,
      description:
        'The ARN of S3 bucket used to deploy the documentation site.',
    });

    this.bucketNameCfnOutput = new CfnOutput(this, 'DocsBucketName', {
      value: this.bucket.bucketName,
      description:
        'The name of S3 bucket used to deploy the documentation site.',
    });
  }

  private setupDistribution(props: FaimsDocsProps): {
    bucket: aws_s3.IBucket;
    distribution: IDistribution;
  } {
    // CSP for static docs: allow same-origin fonts, styles, and inline script
    // (Sphinx/Wagtail theme)
    const csp =
      "default-src 'self'; font-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

    const website = new StaticWebsite(this, 'docs-website', {
      hostedZone: props.hostedZone,
      domainNames: [props.domainName],
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
      certificate: props.certificate,
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: csp,
          override: true,
        },
      },
    });

    return {bucket: website.bucket, distribution: website.distribution};
  }

  private setupBundling(props: FaimsDocsProps) {
    const rootPath = path.resolve(process.cwd(), getPathToRoot());
    const docsPath = path.join(rootPath, 'docs');

    const environment: {[key: string]: string} = {
      VITE_APP_NAME: props.appName,
      VITE_NOTEBOOK_NAME: props.notebookName,
      VITE_WEBSITE_TITLE: props.managementWebsiteTitle,
      // For now, we need to use default as the other themes (e.g. BSS) is not
      // ready yet - need to put in our own screenshots
      VITE_THEME: 'default',
      VITE_API_URL: props.apiUrl,
      VITE_APP_URL: props.appUrl,
      VITE_WEB_URL: props.webUrl,
      ANDROID_APP_PUBLIC_URL: props.androidAppPublicUrl,
      IOS_APP_PUBLIC_URL: props.iosAppPublicUrl,
    };

    const sphinxImage = DockerImage.fromBuild(docsPath, {
      file: 'Dockerfile',
    });

    new aws_s3_deployment.BucketDeployment(this, 'docs-deploy', {
      destinationBucket: this.bucket,
      distribution: this.distribution,
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
            environment,
            command: [
              'bash',
              '-c',
              [
                'mkdir -p /tmp/sphinx-build',
                'cp -r /asset-input/user/. /tmp/sphinx-build/',
                'cd /tmp/sphinx-build',
                'sphinx-build -b html . _build/html',
                'cp -r _build/html/* /asset-output/',
              ].join(' && '),
            ],
          },
        }),
      ],
    });
  }
}
