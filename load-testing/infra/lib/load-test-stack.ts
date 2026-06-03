import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {
  DOCKER_ASSET_EXCLUDES,
  type LoadTestInfraConfig,
  metricsDomain,
  repoRootFromHere,
} from './config';

export interface LoadTestStackProps extends cdk.StackProps {
  config: LoadTestInfraConfig;
}

export class LoadTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LoadTestStackProps) {
    super(scope, id, props);

    const config = props.config;
    const metricsFqdn = metricsDomain(config);
    const repoRoot = path.resolve(repoRootFromHere(__dirname));

    // --- VPC (public subnets only — tasks reach DEV over HTTPS) ---
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(config.VPC_CIDR),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const publicSubnets = vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC});

    // --- Security groups ---
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsTasksSg', {
      vpc,
      description: 'Load test ECS Fargate tasks (coordinator + agents)',
      allowAllOutbound: true,
    });

    const metricsSecurityGroup = new ec2.SecurityGroup(this, 'MetricsEc2Sg', {
      vpc,
      description: 'Metrics EC2 — Grafana, Pushgateway, Prometheus',
      allowAllOutbound: true,
    });

    metricsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(config.ALLOWED_GRAFANA_CIDR),
      ec2.Port.tcp(3030),
      'Grafana'
    );
    metricsSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(9091),
      'Pushgateway from ECS tasks'
    );
    ecsSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(4000),
      'Coordinator HTTP from agent tasks'
    );

    // --- Docker images (built during cdk deploy, pushed to bootstrap ECR) ---
    const coordinatorImage = new ecr_assets.DockerImageAsset(
      this,
      'CoordinatorImage',
      {
        directory: repoRoot,
        file: 'load-testing/coordinator/Dockerfile',
        exclude: DOCKER_ASSET_EXCLUDES,
        platform: ecr_assets.Platform.LINUX_AMD64,
      }
    );

    const agentImage = new ecr_assets.DockerImageAsset(this, 'AgentImage', {
      directory: repoRoot,
      file: 'load-testing/agents/Dockerfile',
      exclude: DOCKER_ASSET_EXCLUDES,
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    // --- ECS cluster + task definitions (RunTask only — no services) ---
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const coordinatorLogGroup = new logs.LogGroup(this, 'CoordinatorLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const agentLogGroup = new logs.LogGroup(this, 'AgentLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const coordinatorTaskDef = new ecs.FargateTaskDefinition(
      this,
      'CoordinatorTaskDef',
      {
        cpu: config.COORDINATOR_CPU,
        memoryLimitMiB: config.COORDINATOR_MEMORY_MIB,
      }
    );

    coordinatorTaskDef.addContainer('coordinator', {
      image: ecs.ContainerImage.fromDockerImageAsset(coordinatorImage),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: coordinatorLogGroup,
        streamPrefix: 'coordinator',
      }),
      environment: {
        PORT: '4000',
        PHASE_ADVANCE_STRATEGY: 'all_ready',
      },
      portMappings: [{containerPort: 4000, protocol: ecs.Protocol.TCP}],
    });

    const agentTaskDef = new ecs.FargateTaskDefinition(this, 'AgentTaskDef', {
      cpu: config.AGENT_CPU,
      memoryLimitMiB: config.AGENT_MEMORY_MIB,
    });

    const agentLinux = new ecs.LinuxParameters(this, 'AgentLinuxParams', {
      sharedMemorySize: 2048,
    });

    agentTaskDef.addContainer('agent', {
      image: ecs.ContainerImage.fromDockerImageAsset(agentImage),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: agentLogGroup,
        streamPrefix: 'agent',
      }),
      linuxParameters: agentLinux,
      environment: {
        HEADLESS: 'true',
        SESSIONS_PER_AGENT: '1',
        DASS_APP_URL: config.DASS_APP_URL,
        DASS_API_URL: config.DASS_API_URL,
        COUCH_URL: config.COUCH_URL,
      },
    });

    // --- Metrics EC2 bundle (observability compose + configs) ---
    const metricsBundle = new s3assets.Asset(this, 'MetricsBundle', {
      path: path.join(__dirname, '../ec2-bundle'),
    });

    const metricsRole = new iam.Role(this, 'MetricsInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore'
        ),
      ],
    });
    metricsBundle.grantRead(metricsRole);

    if (config.COUCH_PASSWORD_SECRET_ARN) {
      const couchSecret = sm.Secret.fromSecretPartialArn(
        this,
        'CouchSecret',
        config.COUCH_PASSWORD_SECRET_ARN
      );
      couchSecret.grantRead(metricsRole);
    }

    const couchSecretArn = config.COUCH_PASSWORD_SECRET_ARN ?? '';
    const couchPasswordInline = config.COUCH_PASSWORD ?? '';

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      'dnf install -y docker jq',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user',
      'mkdir -p /opt/loadtest',
      `aws s3 cp s3://${metricsBundle.s3BucketName}/${metricsBundle.s3ObjectKey} /tmp/loadtest-bundle.zip`,
      'dnf install -y unzip',
      'unzip -o /tmp/loadtest-bundle.zip -d /opt/loadtest',
      'chmod -R a+rX /opt/loadtest',
      `cat > /opt/loadtest/.env <<'ENVEOF'
COUCHDB_EXPORTER_URL=${config.COUCH_URL}
COUCH_USER=${config.COUCH_USER}
COUCHDB_EXPORTER_VERSION=latest
PROMETHEUS_PORT=9090
PUSHGATEWAY_PORT=9091
GRAFANA_PORT=3030
COUCHDB_EXPORTER_PORT=9984
ENVEOF`,
      ...(config.COUCH_PASSWORD_SECRET_ARN
        ? [
            `COUCH_PASSWORD=$(aws secretsmanager get-secret-value --secret-id '${config.COUCH_PASSWORD_SECRET_ARN}' --query SecretString --output text | jq -r .password)`,
            'echo "COUCH_PASSWORD=$COUCH_PASSWORD" >> /opt/loadtest/.env',
          ]
        : [
            `echo "COUCH_PASSWORD=${couchPasswordInline}" >> /opt/loadtest/.env`,
          ]),
      `echo "Metrics bundle installed. Connect via Session Manager, then:"`,
      `echo "  cd /opt/loadtest && docker compose up -d"`,
      `echo "Grafana: http://${metricsFqdn}:3030"`
    );

    const metricsInstance = new ec2.Instance(this, 'MetricsInstance', {
      vpc,
      vpcSubnets: publicSubnets,
      instanceType: new ec2.InstanceType(config.METRICS_INSTANCE_TYPE),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: metricsSecurityGroup,
      role: metricsRole,
      userData,
      ssmSessionPermissions: true,
    });

    const eip = new ec2.CfnEIP(this, 'MetricsEip', {
      domain: 'vpc',
      instanceId: metricsInstance.instanceId,
    });

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      'HostedZone',
      {
        hostedZoneId: config.HOSTED_ZONE_ID,
        zoneName: config.HOSTED_ZONE_NAME,
      }
    );

    new route53.ARecord(this, 'MetricsDns', {
      zone: hostedZone,
      recordName: config.METRICS_SUBDOMAIN,
      target: route53.RecordTarget.fromIpAddresses(eip.ref),
      ttl: cdk.Duration.minutes(5),
    });

    // --- Stack outputs (consumed by scripts/run-load-test.sh) ---
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster for RunTask',
      exportName: `${config.STACK_NAME}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: cluster.clusterArn,
      description: 'ECS cluster ARN',
    });

    new cdk.CfnOutput(this, 'CoordinatorTaskDefinitionArn', {
      value: coordinatorTaskDef.taskDefinitionArn,
      description: 'Task definition for one-shot coordinator runs',
      exportName: `${config.STACK_NAME}-CoordinatorTaskDefinitionArn`,
    });

    new cdk.CfnOutput(this, 'AgentTaskDefinitionArn', {
      value: agentTaskDef.taskDefinitionArn,
      description: 'Task definition for one-shot agent worker runs',
      exportName: `${config.STACK_NAME}-AgentTaskDefinitionArn`,
    });

    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: ecsSecurityGroup.securityGroupId,
      description: 'Security group for coordinator and agent tasks',
      exportName: `${config.STACK_NAME}-EcsSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: publicSubnets.subnetIds.join(','),
      description: 'Comma-separated public subnet IDs for awsvpc RunTask',
      exportName: `${config.STACK_NAME}-PublicSubnetIds`,
    });

    new cdk.CfnOutput(this, 'MetricsInstanceId', {
      value: metricsInstance.instanceId,
      description: 'EC2 instance running observability compose (start via SSM)',
      exportName: `${config.STACK_NAME}-MetricsInstanceId`,
    });

    new cdk.CfnOutput(this, 'MetricsDnsName', {
      value: metricsFqdn,
      description: 'Route53 name for Grafana / metrics host',
      exportName: `${config.STACK_NAME}-MetricsDnsName`,
    });

    new cdk.CfnOutput(this, 'MetricsEipAllocationId', {
      value: eip.attrAllocationId,
      description: 'Elastic IP allocation id for metrics EC2',
    });

    new cdk.CfnOutput(this, 'CoordinatorImageUri', {
      value: coordinatorImage.imageUri,
      description: 'ECR URI built for coordinator (also embedded in task def)',
    });

    new cdk.CfnOutput(this, 'AgentImageUri', {
      value: agentImage.imageUri,
      description: 'ECR URI built for agent (also embedded in task def)',
    });

    new cdk.CfnOutput(this, 'TargetDassAppUrl', {
      value: config.DASS_APP_URL,
      description: 'Default DASS app URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'TargetDassApiUrl', {
      value: config.DASS_API_URL,
      description: 'Default DASS API URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'TargetCouchUrl', {
      value: config.COUCH_URL,
      description: 'Default Couch URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'PushgatewayUrlTemplate', {
      value: `http://<metrics-private-ip>:9091`,
      description:
        'Set PROMETHEUS_PUSHGATEWAY_URL on coordinator overrides after resolving metrics EC2 private IP',
    });
  }
}
