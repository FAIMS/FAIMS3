import {ICertificate} from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {IVpc, Vpc} from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {Construct} from 'constructs';

/**
 * Properties for the SharedBalancers construct
 */
export interface SharedBalancersProps {
  /** The VPC in which to create the ALB */
  vpc: ec2.IVpc;
  /** Whether the ALB should be internet-facing */
  isPublic: boolean;
  /** The type of subnets to place the ALB in */
  subnetType: ec2.SubnetType;
  /** List of SSL/TLS certificates for the HTTPS listener */
  certificates: elb.ListenerCertificate[];
}

/**
 * A construct that manages a shared Application Load Balancer
 * along with its HTTP and HTTPS listeners and routing configurations.
 */
export class SharedBalancer extends Construct {
  /** The default HTTPS port */
  private readonly httpsPort: number = 443;
  /** The default HTTP port */
  private readonly httpPort: number = 80;

  /** The Application Load Balancer instance */
  public readonly alb: elb.ApplicationLoadBalancer;

  /** The HTTPS listener for the Application Load Balancer */
  public readonly httpsListener: elb.ApplicationListener;
  /** The HTTP listener for the Application Load Balancer */
  public readonly httpListener: elb.ApplicationListener;

  /**
   * Creates a new SharedBalancers instance.
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties for the SharedBalancers
   */
  constructor(scope: Construct, id: string, props: SharedBalancersProps) {
    super(scope, id);

    // Set up the Application Load Balancer
    this.alb = new elb.ApplicationLoadBalancer(this, 'alb', {
      vpc: props.vpc,
      internetFacing: props.isPublic,
      vpcSubnets: {subnetType: props.subnetType},
    });

    // Set up the HTTPS listener
    this.httpsListener = new elb.ApplicationListener(this, 'https-listener', {
      loadBalancer: this.alb,
      certificates: props.certificates,
      defaultAction: elb.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody:
          'Service does not exist. Contact administrator if you believe this is an error.',
      }),
      port: this.httpsPort,
    });

    // Set up the HTTP listener
    this.httpListener = new elb.ApplicationListener(this, 'http-listener', {
      loadBalancer: this.alb,
      defaultAction: elb.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody:
          'Service does not exist. Contact administrator if you believe this is an error.',
      }),
      port: this.httpPort,
    });
  }

  /**
   * Adds certificates to the HTTPS listener
   * @param id Unique identifier for this operation
   * @param certificates List of certificates to add
   */
  addHttpsCertificates(
    id: string,
    certificates: elb.ListenerCertificate[]
  ): void {
    this.httpsListener.addCertificates(id, certificates);
  }

  /**
   * Adds a conditional HTTPS target with HTTP redirect
   * @param actionId Unique identifier for this action
   * @param targetGroup The target group to forward requests to
   * @param conditions List of conditions to match for this rule
   * @param priority Priority of the listener rule
   * @param httpRedirectPriority Priority of the HTTP to HTTPS redirect rule
   */
  addHttpRedirectedConditionalHttpsTarget(
    actionId: string,
    targetGroup: elb.ApplicationTargetGroup,
    conditions: elb.ListenerCondition[],
    priority: number,
    httpRedirectPriority: number
  ): void {
    // Add the listener action on HTTPS listener
    this.httpsListener.addAction(actionId, {
      action: elb.ListenerAction.forward([targetGroup]),
      conditions,
      priority,
    });

    // Add HTTP redirect
    this.httpListener.addAction(`${actionId}-https-redirect`, {
      action: elb.ListenerAction.redirect({
        permanent: true,
        port: this.httpsPort.toString(),
        protocol: elb.Protocol.HTTPS,
      }),
      conditions,
      priority: httpRedirectPriority,
    });
  }

  /**
   * Adds a conditional HTTP route
   * @param id Unique identifier for this route
   * @param targetGroup The target group to forward requests to
   * @param conditions List of conditions to match for this rule
   * @param priority Priority of the listener rule
   */
  addConditionalHttpRoute(
    id: string,
    targetGroup: elb.ApplicationTargetGroup,
    conditions: elb.ListenerCondition[],
    priority: number
  ): void {
    this.httpListener.addAction(id, {
      action: elb.ListenerAction.forward([targetGroup]),
      conditions,
      priority,
    });
  }
}

/**
 * Properties for the FaimsNetworking construct.
 */
export interface FaimsNetworkingProps {
  /** The SSL/TLS certificate to use for HTTPS connections */
  certificate: ICertificate;
}

/**
 * Represents the networking infrastructure for the FAIMS application.
 */
export class FaimsNetworking extends Construct {
  /** The VPC where the networking resources are created */
  public readonly vpc: IVpc;
  /** The shared Application Load Balancer */
  public readonly sharedBalancer: SharedBalancer;

  /**
   * Creates a new FaimsNetworking instance.
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties for the FaimsNetworking
   */
  constructor(scope: Construct, id: string, props: FaimsNetworkingProps) {
    super(scope, id);

    // Setup basic VPC with some public subnet(s) as per default
    this.vpc = new Vpc(this, 'vpc', {
      // At least 2 needed for LB
      maxAzs: 2,
      // No need for nat gateways right now since no private subnet outbound traffic
      natGateways: 0,
    });

    // Create the shared ALB - public facing
    this.sharedBalancer = new SharedBalancer(this, 'shared-balancer', {
      vpc: this.vpc,
      certificates: [props.certificate],
      isPublic: true,
      subnetType: ec2.SubnetType.PUBLIC,
    });
  }
}
