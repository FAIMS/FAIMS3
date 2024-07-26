import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface FaimsNetworkingProps {}

export class FaimsNetworking extends Construct {
  vpc: IVpc;
  constructor(scope: Construct, id: string, props: FaimsNetworkingProps) {
    super(scope, id);

    // Setup basic VPC with some public subnet(s) as per default
    this.vpc = new Vpc(this, "vpc", {
      // At least 2 needed for LB
      maxAzs: 2,

      // No need for nat gateways right now since no private subnet outbound traffic
      natGateways: 0,
    });
  }
}
