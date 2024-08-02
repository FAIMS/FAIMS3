import { Construct } from "constructs";
import { StaticWebsite } from "@cloudcomponents/cdk-static-website";
import {
  AssetHashType,
  CfnOutput,
  Duration,
  RemovalPolicy,
  aws_lambda,
  aws_s3,
  aws_s3_deployment,
} from "aws-cdk-lib";
import { Source } from "aws-cdk-lib/aws-s3-deployment";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { getPathHash, getPathToRoot } from "../util/mono";

export interface FaimsFrontEndProps {
  // FAIMS main website

  // The HZ to produce record in
  faimsHz: IHostedZone;
  // The DNS cert to use for domain LB (needs to be us-east-1)
  faimsUsEast1Certificate: ICertificate;
  // Domain name
  faimsDomainNames: Array<string>;

  // Designer standalone website
  designerHz: IHostedZone;
  designerUsEast1Certificate: ICertificate;
  designerDomainNames: Array<string>;

  // e.g. db.domain.com
  couchDbDomainOnly: string;
  // e.g. 443
  couchDbPort: number;

  // conductor e.g. https://api.com
  conductorUrl: string;
}

export class FaimsFrontEnd extends Construct {
  faimsBucket: aws_s3.IBucket;
  faimsDistribution: IDistribution;
  faimsBucketArnCfnOutput: CfnOutput;
  faimsBucketNameCfnOutput: CfnOutput;

  designerBucket: aws_s3.IBucket;
  designerDistribution: IDistribution;
  designerBucketArnCfnOutput: CfnOutput;
  designerBucketNameCfnOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: FaimsFrontEndProps) {
    super(scope, id);

    // Main Faims frontend
    this.deployFaims(props);

    // Designer standalone
    this.deployDesigner(props);
  }

  deployFaims(props: FaimsFrontEndProps) {
    // setup distribution and static bucket hosting
    this.setupFaimsDistribution(props);

    // Deploy into this bucket
    this.setupFaimsBundling(props);

    // Bucket arn
    this.faimsBucketArnCfnOutput = new CfnOutput(this, "FaimsBucketArn", {
      value: this.faimsBucket.bucketArn,
      description:
        "The ARN of S3 bucket used to deploy the website static contents.",
    });

    // Bucket name
    this.faimsBucketNameCfnOutput = new CfnOutput(this, "FaimsBucketName", {
      value: this.faimsBucket.bucketName,
      description:
        "The name of S3 bucket used to deploy the website static contents.",
    });
  }

  setupFaimsDistribution(props: FaimsFrontEndProps) {
    const website = new StaticWebsite(this, "faims-website", {
      hostedZone: props.faimsHz,
      domainNames: props.faimsDomainNames,
      removalPolicy: RemovalPolicy.DESTROY,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: "/index.html",
        },
        // 403 should go 200 to index.html so that react router can work!
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: "/index.html",
        },
      ],
      certificate: props.faimsUsEast1Certificate,

      // TODO dig into this more to make it more secure - just getting it working for now
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          // enable connection to the couch db URL
          contentSecurityPolicy: `connect-src 'self' https://${props.couchDbDomainOnly} ${props.conductorUrl}`,
          override: true,
        },
      },
    });

    this.faimsBucket = website.bucket;
    this.faimsDistribution = website.distribution;
  }

  setupFaimsBundling(props: FaimsFrontEndProps) {
    const buildScript = "build.sh";
    // need to build from root because requires context in docker bundling from
    // monorepo root
    // TODO consider approaches here to improve build time and
    // hashing
    const buildPath = getPathToRoot();
    const appPath = "app";
    const outputPath = "build";

    const environment: { [key: string]: string } = {
      platform: "web",
      serverprefix: "fieldmark",
      VITE_CLUSTER_ADMIN_GROUP_NAME: "cluster-admin",
      VITE_COMMIT_VERSION: "unknown TBD",
      VITE_DEBUG_APP: "true",
      VITE_DEBUG_POUCHDB: "true",
      VITE_USE_HTTPS: "true",
      VITE_SHOW_WIPE: "true",
      VITE_SHOW_NEW_NOTEBOOK: "true",
      VITE_SHOW_MINIFAUXTON: "true",

      // Couch DB
      VITE_DIRECTORY_HOST: props.couchDbDomainOnly,
      VITE_DIRECTORY_PORT: `${props.couchDbPort}`,

      // Conductor API URL
      VITE_CONDUCTOR_URL: props.conductorUrl,
      VITE_PRODUCTION_BUILD: "true",
      VITE_SERVICES: "FAIMSTEXT",
      VITE_TAG: "CDKDeployment",
    };

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, "deploy", {
      destinationBucket: this.faimsBucket,
      // Setup with distribution so that the deployment will invalidate
      // distribution cache when the files are redeployed
      distribution: this.faimsDistribution,
      distributionPaths: ["/*"],
      sources: [
        Source.asset(buildPath, {
          // TODO optimise
          exclude: ["infrastructure"],
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
              "bash",
              "-c",
              `
            cd /asset-input
            "npm i && npm run github-build-app",
            cd ${appPath}
            cp -R ${outputPath}/* /asset-output
            `,
            ],
            // Local bundling is faster for quick local deploy
            local: {
              tryBundle(outputDir: string) {
                // Implement the logic to check if Docker is available
                console.log("Trying local bundling of build files.");

                // Build list of export commands
                const envs = Object.keys(environment)
                  .map((key) => {
                    return `export ${key}=${environment[key] as string}`;
                  })
                  .join(" && ");

                // Perform the same bundling operations performed in the Docker container
                const exec = require("child_process").execSync;
                const commands = [
                  //export environment variables - not included by default
                  envs,
                  `cd ${buildPath}`,
                  "npm i && npm run github-build-app",
                  `cd ${appPath}`,
                  `cp -R ${outputPath}/* ${outputDir}`,
                ];
                console.log(commands);
                exec(commands.join("&& "), { stdio: "inherit" });
                // Return true because bundling is complete
                return true;
              },
            },
          },
        }),
      ],
    });
  }

  deployDesigner(props: FaimsFrontEndProps) {
    // setup distribution and static bucket hosting
    this.setupDesignerDistribution(props);

    // Deploy into this bucket
    this.setupDesignerBundling(props);

    // Bucket arn
    this.designerBucketArnCfnOutput = new CfnOutput(this, "DesignerBucketArn", {
      value: this.designerBucket.bucketArn,
      description:
        "The ARN of S3 bucket used to deploy the website static contents.",
    });

    // Bucket name
    this.designerBucketNameCfnOutput = new CfnOutput(
      this,
      "DesignerBucketName",
      {
        value: this.designerBucket.bucketName,
        description:
          "The name of S3 bucket used to deploy the website static contents.",
      }
    );
  }

  setupDesignerDistribution(props: FaimsFrontEndProps) {
    const website = new StaticWebsite(this, "faims-designer", {
      hostedZone: props.designerHz,
      domainNames: props.designerDomainNames,
      removalPolicy: RemovalPolicy.DESTROY,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: "/index.html",
        },
        // 403 should go 200 to index.html so that react router can work!
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          ttl: Duration.seconds(300),
          responsePagePath: "/index.html",
        },
      ],
      certificate: props.designerUsEast1Certificate,
    });

    this.designerBucket = website.bucket;
    this.designerDistribution = website.distribution;
  }

  setupDesignerBundling(props: FaimsFrontEndProps) {
    const buildScript = "build.sh";
    // need to build from root because requires context in docker bundling from
    // monorepo root
    // TODO consider approaches here to improve build time and
    // hashing
    const buildPath = getPathToRoot();
    const appPath = "designer";
    const outputPath = "build";

    // Setup a deployment into this bucket with static files
    new aws_s3_deployment.BucketDeployment(this, "designer-deploy", {
      destinationBucket: this.designerBucket,
      // Setup with distribution so that the deployment will invalidate
      // distribution cache when the files are redeployed
      distribution: this.designerDistribution,
      distributionPaths: ["/*"],
      sources: [
        Source.asset(buildPath, {
          // TODO optimise
          exclude: ["infrastructure"],
          // Hash the app folder source files only
          assetHash: getPathHash(`${getPathToRoot()}/${appPath}`, [outputPath]),
          assetHashType: AssetHashType.CUSTOM,

          bundling: {
            // Use node image for non local bundling
            image: aws_lambda.Runtime.NODEJS_20_X.bundlingImage,
            // Docker build expects input/output of asset-input/output
            command: [
              "bash",
              "-c",
              `
            cd /asset-input
            cd ${appPath}
            ./${buildScript}
            cp -R ${outputPath}/* /asset-output
            `,
            ],
            // Local bundling is faster for quick local deploy
            local: {
              tryBundle(outputDir: string) {
                // Implement the logic to check if Docker is available
                console.log("Trying local bundling of build files.");

                // Perform the same bundling operations performed in the Docker container
                const exec = require("child_process").execSync;
                const commands = [
                  `cd ${buildPath}`,
                  `cd ${appPath}`,
                  `./${buildScript}`,
                  `cp -R ${outputPath}/* ${outputDir}`,
                ];
                console.log(commands);
                exec(commands.join("&& "), { stdio: "inherit" });
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
