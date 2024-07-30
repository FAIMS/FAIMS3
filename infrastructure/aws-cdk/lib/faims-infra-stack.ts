import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import { FaimsConductor } from "./components/conductor";
import { FaimsFrontEnd } from "./components/front-end";
import { FaimsNetworking } from "./components/networking";
import { EC2CouchDB } from "./components/couch-db";

/**
 * Properties for the FaimsInfraStack
 */
export interface FaimsInfraStackProps extends cdk.StackProps {
  /** Attributes of the hosted zone to use */
  hzAttributes: route53.HostedZoneAttributes;
  /** ARN of the primary SSL/TLS certificate */
  primaryCertArn: string;
  /** ARN of the CloudFront SSL/TLS certificate */
  cloudfrontCertArn: string;
  /** ARN of the public key secret */
  publicKeySecretArn: string;
  /** ARN of the private key secret */
  privateKeySecretArn: string;
}

/**
 * Main infrastructure stack for the FAIMS application
 */
export class FaimsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FaimsInfraStackProps) {
    super(scope, id, props);

    // DNS SETUP
    // =========

    // Setup the hosted zone for domain definitions
    const hz = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "hz",
      props.hzAttributes
    );

    // Domain configurations
    // TODO: Parameterize these domain configurations
    const rootDomain = hz.zoneName;
    const domains = {
      couch: `couchdb.${rootDomain}`,
      conductor: `conductor.${rootDomain}`,
      web: `faims.${rootDomain}`,
      designer: `designer.${rootDomain}`,
    };

    // CERTIFICATES
    // ============

    // Primary certificate for the hosted zone
    const primaryCert = acm.Certificate.fromCertificateArn(
      this,
      "primary-cert",
      props.primaryCertArn
    );

    // CloudFront certificate
    const cfnCert = acm.Certificate.fromCertificateArn(
      this,
      "cfn-cert",
      props.cloudfrontCertArn
    );

    // NETWORKING
    // ==========

    // Setup networking infrastructure
    const networking = new FaimsNetworking(this, "networking", {
      certificate: primaryCert,
    });

    // COUCHDB
    // =======

    // Create a single EC2 cluster which runs CouchDB
    // TODO: Investigate better key setup process for one-click deploy
    const couchDb = new EC2CouchDB(this, "couch-db", {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: domains.couch,
      hz: hz,
      sharedBalancer: networking.sharedBalancer,
    });

    // CONDUCTOR
    // =========

    // Deploy the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, "conductor", {
      vpc: networking.vpc,
      cpu: 1024, // 1 vCPU
      memory: 2048, // 2 GB RAM
      certificate: primaryCert,
      domainName: domains.conductor,
      privateKeySecretArn: props.privateKeySecretArn,
      hz: hz,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${domains.web}`,
      androidAppPublicUrl: "https://fake.com", // TODO: Update with real URL
      iosAppPublicUrl: "https://fake.com", // TODO: Update with real URL
      sharedBalancer: networking.sharedBalancer,
    });

    // FRONT-END
    // =========

    // Deploy the FAIMS 3 web front-end as a S3 CloudFront static website
    const frontEnd = new FaimsFrontEnd(this, "frontend", {
      couchDbDomainOnly: domains.couch,
      couchDbPort: couchDb.exposedPort,
      faimsDomainNames: [domains.web],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,
      designerDomainNames: [domains.designer],
      designerHz: hz,
      designerUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
    });

    // TODO: Add any additional resources or configurations as needed
  }
}
