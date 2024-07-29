import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { FaimsConductor } from "./components/conductor";
import { FaimsFrontEnd } from "./components/front-end";
import { FaimsNetworking } from "./components/networking";
import { HostedZone, HostedZoneAttributes } from "aws-cdk-lib/aws-route53";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { EC2CouchDB } from "./components/couch-db";

export interface FaimsInfraStackProps extends cdk.StackProps {
  hzAttributes: HostedZoneAttributes;
  primaryCertArn: string;
  cloudfrontCertArn: string;
  publicKeySecretArn: string;
  privateKeySecretArn: string;
}
export class FaimsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FaimsInfraStackProps) {
    super(scope, id, props);

    // setup network
    const networking = new FaimsNetworking(this, "networking", {});

    // Setup the hosted zone so we can define domains
    const hz = HostedZone.fromHostedZoneAttributes(
      this,
      "hz",
      props.hzAttributes
    );

    // Domain setups 
    
    // TODO parameterise

    const rootDomain = hz.zoneName;

    // Couch
    const couchSubDomain = "couchdb";
    const fullCouchDomain = `${couchSubDomain}.${rootDomain}`;

    // Conductor
    const conductorSubDomain = "conductor";
    const fullConductorDomain = `${conductorSubDomain}.${rootDomain}`;

    // FAIMS web app
    const webSubDomain = "faims";
    const fullWebDomain = `${webSubDomain}.${rootDomain}`;

    // FAIMS designer
    const designerSubDomain = "designer";
    const fullDesignerDomain = `${designerSubDomain}.${rootDomain}`;

    // Certificate for hz
    const primaryCert = Certificate.fromCertificateArn(
      this,
      "primary-cert",
      props.primaryCertArn
    );
    const cfnCert = Certificate.fromCertificateArn(
      this,
      "cfn-cert",
      props.cloudfrontCertArn
    );

    // Currently the ini file is setup in docker - this means we need to have the JWT public key setup before hand.
    // Maybe we can do this with a custom resource? not sure - okay for now
    // TODO investigate better key setup process which allows for one click deploy

    // Creates a single EC2 cluster which runs CouchDB
    const couchDb = new EC2CouchDB(this, "couch-db", {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: fullCouchDomain,
      hz: hz,
    });

    // Deploys the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, "conductor", {
      vpc: networking.vpc,
      // 1 vcpu 2 gb ram
      cpu: 1024,
      memory: 2048,
      certificate: primaryCert,
      domainName: fullConductorDomain,
      privateKeySecretArn: props.privateKeySecretArn,
      hz: hz,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${fullWebDomain}`,
      // TODO
      androidAppPublicUrl: "https://fake.com",
      iosAppPublicUrl: "https://fake.com",
    });

    // Deploys the FAIMS 3 web front-end as a S3 Cloudfront static website
    const frontEnd = new FaimsFrontEnd(this, "frontend", {
      // CouchDB config
      couchDbDomainOnly: fullCouchDomain,
      couchDbPort: couchDb.exposedPort,

      // Main faims frontend
      faimsDomainNames: [fullWebDomain],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,

      // Designer faims frontend
      designerDomainNames: [fullDesignerDomain],
      designerHz: hz,
      designerUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
    });
  }
}
