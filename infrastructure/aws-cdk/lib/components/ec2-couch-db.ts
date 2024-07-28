/*
 * Created Date: Thursday July 25th 2024 Author: Peter Baker
 * -----
 * Last Modified: Thursday July 25th 2024 10:09:45 am Modified By: Peter Baker
 * -----
 * Description: Uses an EC2 Auto Scaling group with some user data to configure
 * a single CouchDB node. Uses a load balancer for TLS. Exposes load balancer to
 * public traffic but not the couchDB directly.
 * -----
 * HISTORY: Date         By  Comments
 * ----------   --- ---------------------------------------------------------
 */

import { Construct } from "constructs";
import {
  AutoScalingGroup,
  DefaultResult,
  LifecycleTransition,
  UpdatePolicy,
} from "aws-cdk-lib/aws-autoscaling";
import {
  AmazonLinuxGeneration,
  AmazonLinuxImage,
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  UserData,
} from "aws-cdk-lib/aws-ec2";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ARecord, IHostedZone } from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { aws_iam, aws_route53, Duration, RemovalPolicy } from "aws-cdk-lib";
import {
  DnsRecordType,
  PrivateDnsNamespace,
} from "aws-cdk-lib/aws-servicediscovery";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";

export interface EC2CouchDBProps {
  vpc: IVpc;
  domainName: string;
  hz: IHostedZone;
  certificate: ICertificate;
}

export class EC2CouchDB extends Construct {
  public readonly couchEndpoint: string;
  public readonly exposedPort: number = 443;
  public readonly passwordSecret: Secret;

  // TODO retrieve this from mono repo by reading from file OR store/host to
  // allow dynamic reconfiguration? NOTE does not include keys.
  private readonly couchDbConfig: string = `
; CouchDB Configuration Settings for FAIMS
[couchdb]
max_document_size = 4294967296 ; bytes
os_process_timeout = 5000 ; 5 sec
uuid = adf990d5dd21b735f65d4140ad1f10c2
single_node=true

[chttpd]
port = 5984
bind_address = 0.0.0.0
authentication_handlers = {chttpd_auth, cookie_authentication_handler}, {chttpd_auth, jwt_authentication_handler}, {chttpd_auth, default_authentication_handler}

[httpd]
enable_cors = true

[log]
writer = syslog
level = info

[chttpd_auth]
secret = db7a1a86dbc734593febf8ca6fdf0cf8

[cors]
origins = *
headers = accept, authorization, content-type, origin, referer
credentials = true
methods = GET, PUT, POST, HEAD, DELETE
  `.trim();

  constructor(scope: Construct, id: string, props: EC2CouchDBProps) {
    super(scope, id);

    const lbSecurityGroup = new SecurityGroup(
      this,
      "LoadBalancerSecurityGroup",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: "Security group for Load Balancer",
      }
    );

    // Create a security group for the EC2 instance
    const couchSecurityGroup = new SecurityGroup(this, "CouchDBSecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: "Security group for CouchDB EC2 instances",
    });

    couchSecurityGroup.addIngressRule(
      lbSecurityGroup,
      Port.tcp(5984),
      "Allow CouchDB access from load balancer"
    );

    // Create a secret for the CouchDB admin password
    this.passwordSecret = new Secret(this, "CouchDBAdminPassword", {
      generateSecretString: {
        excludeCharacters: '/\\"%@',
        generateStringKey: "password",
        passwordLength: 16,
        secretStringTemplate: JSON.stringify({ username: "admin" }),
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create CloudMap service
    // TODO understand if this should be HTTP namespace or private DNS name space
    const namespace = new PrivateDnsNamespace(this, "CouchDBNamespace", {
      vpc: props.vpc,
      name: "couchdb.local",
    });

    const service = namespace.createService("CouchDBService", {
      dnsRecordType: DnsRecordType.A,
      dnsTtl: Duration.seconds(60),
    });

    // Create a dead-letter queue for failed deregistrations
    const dlq = new Queue(this, "DeregistrationDLQ");

    // This lambda instance runs on instance termination in the auto scaling
    // group to deregister the instance from the cloudmap service
    // TODO improve asset hashing here to avoid including stuff we don't need
    const deregisterLambda = new lambda.Function(
      this,
      "DeregisterInstanceLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("src/deregister-lambda/dist"),
        environment: {
          SERVICE_ID: service.serviceId,
        },
        deadLetterQueue: dlq,
      }
    );

    // Create user data script to install and configure CouchDB
    const userData = UserData.forLinux();
    userData.addCommands(
      // Update yum and install dependencies
      "yum update -y",
      "yum install -y docker jq awscli",
      // Run couch DB with docker service
      "systemctl start docker",
      "systemctl enable docker",
      "docker pull couchdb:latest",
      "SECRET_ARN=" + this.passwordSecret.secretArn,
      // Get the region dynamically
      "REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
      "export AWS_DEFAULT_REGION=$REGION",
      "ADMIN_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text | jq -r .password)",
      // Create CouchDB configuration file
      "mkdir -p /opt/couchdb/etc/local.d",
      `cat > /opt/couchdb/etc/local.d/local.ini << EOL
${this.couchDbConfig}
EOL`,
      // Append admin and password configuration to local.ini -> note this will
      // be hashed upon couch instance start.
      `echo "[admins]" >> /opt/couchdb/etc/local.d/local.ini`,
      `echo "admin = $ADMIN_PASSWORD" >> /opt/couchdb/etc/local.d/local.ini`,
      // Run CouchDB container with mounted configuration
      "docker run -d --name couchdb -p 5984:5984 -v /opt/couchdb/etc/local.d:/opt/couchdb/etc/local.d couchdb:latest",
      // Register the instance with CloudMap
      // Get token for metadata api
      'TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")',
      // get instance ID
      'INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)',
      // get Private Ip
      'PRIVATE_IP=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/local-ipv4)',
      // use service discovery AWS CLI to register instance into specified service
      "SERVICE_ID=" + service.serviceId,
      `aws servicediscovery register-instance --service-id $SERVICE_ID --instance-id $INSTANCE_ID --attributes AWS_INSTANCE_IPV4=$PRIVATE_IP,AWS_INSTANCE_PORT=5984`
    );
    // Create an Auto Scaling Group with a single EC2 instance
    const asg = new AutoScalingGroup(this, "CouchDBAsg", {
      vpc: props.vpc,
      // T3 Small for now
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
      // TODO place into private and have NAT gateway (for setting up instances
      // we need internet connectivity) in future
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      associatePublicIpAddress: true,
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData,
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      securityGroup: couchSecurityGroup,
      updatePolicy: UpdatePolicy.rollingUpdate(),
    });

    // Add lifecycle hook to deregister
    asg.addLifecycleHook("DeregisterFromCloudMap", {
      lifecycleTransition: LifecycleTransition.INSTANCE_TERMINATING,
      heartbeatTimeout: Duration.seconds(300),
      defaultResult: DefaultResult.CONTINUE,
    });

    // trigger deregister when scale out occurs
    new Rule(this, "TerminatingInstanceRule", {
      eventPattern: {
        source: ["aws.autoscaling"],
        detailType: ["EC2 Instance-terminate Lifecycle Action"],
        detail: {
          AutoScalingGroupName: [asg.autoScalingGroupName],
        },
      },
      targets: [new LambdaFunction(deregisterLambda)],
    });

    // service discovery perms
    const permsForServiceDiscovery = [
      "servicediscovery:DeregisterInstance",
      "servicediscovery:DiscoverInstances",
      "servicediscovery:RegisterInstance",
      "route53:GetHealthCheck",
      "route53:DeleteHealthCheck",
      "route53:CreateHealthCheck",
      "route53:UpdateHealthCheck",
      "route53:ChangeResourceRecordSets",
      "ec2:DescribeInstances",
    ];

    // Grant the EC2 instance and lambda function permission to register and deregister instances in the service
    asg.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: permsForServiceDiscovery,
        // TODO tighten this and maybe split by service e.g. service discovery, route 53, ec2
        resources: ["*"],
      })
    );

    // lambda needs above and also complete lifecycle action
    deregisterLambda.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: permsForServiceDiscovery.concat([
          "autoscaling:CompleteLifecycleAction",
        ]),
        // TODO tighten this and maybe split by service e.g. service discovery, route 53, ec2
        resources: ["*"],
      })
    );

    // Grant the EC2 instance permission to read the secret
    this.passwordSecret.grantRead(asg.role);

    // Grant necessary permissions
    deregisterLambda.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ["autoscaling:CompleteLifecycleAction"],
        resources: [asg.autoScalingGroupArn],
      })
    );

    // Create an Application Load Balancer
    const lb = new ApplicationLoadBalancer(this, "CouchDBLoadBalancer", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: lbSecurityGroup,
    });

    // Add a listener to the load balancer
    const listener = lb.addListener("Listener", {
      port: this.exposedPort,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [props.certificate],
    });

    // HTTPS inbound 443 to LB
    lbSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      "Allow inbound traffic to database from public on HTTPS port 443"
    );

    // Add the Auto Scaling Group as a target to the listener
    listener.addTargets("CouchDBTarget", {
      port: 5984,
      protocol: ApplicationProtocol.HTTP,
      targets: [asg],
      healthCheck: {
        path: "/",
        unhealthyThresholdCount: 3,
        healthyThresholdCount: 2,
        interval: Duration.seconds(30),
      },
    });

    // Create a DNS record
    new ARecord(this, "CouchDBAliasRecord", {
      zone: props.hz,
      recordName: props.domainName,
      target: aws_route53.RecordTarget.fromAlias(new LoadBalancerTarget(lb)),
    });

    // For debugging TODO remove
    // Allow inbound traffic for SSM Instance Connect
    couchSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      "Allow SSM Instance Connect"
    );

    // Add SSM Instance Connect permissions to the instance role
    asg.role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    this.couchEndpoint = `https://${props.domainName}:${this.exposedPort}`;
  }
}
