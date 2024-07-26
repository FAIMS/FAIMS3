#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HostedZoneAttributes } from "aws-cdk-lib/aws-route53";
import { FaimsInfraStack } from "../lib/faims-infra-stack";

const app = new cdk.App();

// hz to target
const zoneAttributes: HostedZoneAttributes = {
  hostedZoneId: "TODO",
  zoneName: "TODO",
};
const primaryCertArn =
  "TODO";
const cloudfrontCertArn =
  "TODO";

new FaimsInfraStack(app, "FaimsInfraStack", {
  // Target ap-southeast-2 for nbic-4 account with ID below
  env: {
    account: "TODO",
    region: "TODO",
  },
  hzAttributes: zoneAttributes,
  primaryCertArn: primaryCertArn,
  cloudfrontCertArn: cloudfrontCertArn,
  privateKeySecretArn:
    "TODO",
  publicKeySecretArn:
    "TODO",
});
