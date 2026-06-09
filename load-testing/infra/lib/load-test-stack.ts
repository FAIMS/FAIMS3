import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {
  DOCKER_ASSET_EXCLUDES,
  type LoadTestInfraConfig,
  metricsDomain,
  repoRootFromHere,
} from './config';

/** Map config string to ECS Container Insights enum value. */
function containerInsightsSetting(
  config: LoadTestInfraConfig
): ecs.ContainerInsights {
  switch (config.CONTAINER_INSIGHTS) {
    case 'disabled':
      return ecs.ContainerInsights.DISABLED;
    case 'enabled':
      return ecs.ContainerInsights.ENABLED;
    case 'enhanced':
    default:
      return ecs.ContainerInsights.ENHANCED;
  }
}

/** Create execution + task IAM roles with SSM channel access for ECS Exec. */
function createFargateTaskRoles(
  scope: Construct,
  idPrefix: string
): {executionRole: iam.Role; taskRole: iam.Role} {
  const executionRole = new iam.Role(scope, `${idPrefix}ExecutionRole`, {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AmazonECSTaskExecutionRolePolicy'
      ),
    ],
  });

  const taskRole = new iam.Role(scope, `${idPrefix}TaskRole`, {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  });
  taskRole.addToPolicy(
    new iam.PolicyStatement({
      actions: [
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    })
  );

  return {executionRole, taskRole};
}

/** CloudWatch log driver; non-blocking mode for long-lived coordinator tasks. */
function awsLogsDriver(
  logGroup: logs.ILogGroup,
  streamPrefix: string,
  options: {nonBlocking?: boolean} = {}
): ecs.LogDriver {
  if (options.nonBlocking) {
    return ecs.LogDrivers.awsLogs({
      logGroup,
      streamPrefix,
      mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      maxBufferSize: cdk.Size.mebibytes(25),
    });
  }
  // Blocking (default): reliable delivery for short-lived RunTask agents.
  return ecs.LogDrivers.awsLogs({
    logGroup,
    streamPrefix,
  });
}

export interface LoadTestStackProps extends cdk.StackProps {
  config: LoadTestInfraConfig;
}

/** CDK stack: ECS task defs, metrics EC2, S3 plans bucket, and Route53 record. */
export class LoadTestStack extends cdk.Stack {
  /** Provision load-test infrastructure from validated infra config. */
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

    if (config.ENABLE_VPC_FLOW_LOGS === 'true') {
      const vpcFlowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      new ec2.FlowLog(this, 'VpcFlowLog', {
        resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
        destination: ec2.FlowLogDestination.toCloudWatchLogs(vpcFlowLogGroup),
      });
    }

    // --- Security groups ---
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsTasksSg', {
      vpc,
      description: 'Load test ECS Fargate tasks (coordinator + agents)',
      allowAllOutbound: true,
    });

    const metricsSecurityGroup = new ec2.SecurityGroup(this, 'MetricsEc2Sg', {
      vpc,
      description: 'Metrics EC2 - Grafana, Pushgateway, Prometheus',
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
      ec2.Peer.ipv4(config.ALLOWED_COORDINATOR_CIDR),
      ec2.Port.tcp(4000),
      'Coordinator HTTP from run-load-test.sh health checks and agents'
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
      containerInsightsV2: containerInsightsSetting(config),
    });

    const coordinatorRoles = createFargateTaskRoles(this, 'Coordinator');
    const agentRoles = createFargateTaskRoles(this, 'Agent');

    const sequencePlansBucket = new s3.Bucket(this, 'SequencePlansBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    sequencePlansBucket.grantRead(coordinatorRoles.taskRole);

    const coordinatorLogGroup = new logs.LogGroup(this, 'CoordinatorLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const agentLogGroup = new logs.LogGroup(this, 'AgentLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    coordinatorLogGroup.grantWrite(coordinatorRoles.executionRole);
    agentLogGroup.grantWrite(agentRoles.executionRole);

    const coordinatorTaskDef = new ecs.FargateTaskDefinition(
      this,
      'CoordinatorTaskDef',
      {
        cpu: config.COORDINATOR_CPU,
        memoryLimitMiB: config.COORDINATOR_MEMORY_MIB,
        executionRole: coordinatorRoles.executionRole,
        taskRole: coordinatorRoles.taskRole,
      }
    );

    coordinatorTaskDef.addContainer('coordinator', {
      image: ecs.ContainerImage.fromDockerImageAsset(coordinatorImage),
      logging: awsLogsDriver(coordinatorLogGroup, 'coordinator', {
        nonBlocking: true,
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
      executionRole: agentRoles.executionRole,
      taskRole: agentRoles.taskRole,
    });

    agentTaskDef.addContainer('agent', {
      image: ecs.ContainerImage.fromDockerImageAsset(agentImage),
      logging: awsLogsDriver(agentLogGroup, 'agent'),
      linuxParameters: new ecs.LinuxParameters(agentTaskDef, 'AgentLinux', {
        initProcessEnabled: true,
      }),
      stopTimeout: cdk.Duration.seconds(120),
      environment: {
        HEADLESS: 'true',
        SESSIONS_PER_AGENT: '1',
        FAIMS_APP_URL: config.FAIMS_APP_URL,
        FAIMS_API_URL: config.FAIMS_API_URL,
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
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchAgentServerPolicy'
        ),
      ],
    });
    metricsBundle.grantRead(metricsRole);

    if (config.COUCH_PASSWORD_SECRET_ARN) {
      const couchSecret = sm.Secret.fromSecretCompleteArn(
        this,
        'CouchSecret',
        config.COUCH_PASSWORD_SECRET_ARN
      );
      couchSecret.grantRead(metricsRole);
      metricsRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          resources: [config.COUCH_PASSWORD_SECRET_ARN],
        })
      );
    }

    const couchPasswordInline = config.COUCH_PASSWORD ?? '';

    const bundleS3Uri = `s3://${metricsBundle.s3BucketName}/${metricsBundle.s3ObjectKey}`;

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      'dnf clean all || true',
      'for attempt in 1 2 3 4 5; do',
      '  dnf install -y docker jq unzip && break',
      '  dnf clean packages || true',
      '  sleep $((attempt * 5))',
      'done',
      'command -v docker',
      'command -v curl',
      'command -v jq',
      'command -v unzip',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user || true',
      'mkdir -p /opt/loadtest',
      `aws s3 cp '${bundleS3Uri}' /tmp/loadtest-bundle.zip`,
      'unzip -o /tmp/loadtest-bundle.zip -d /opt/loadtest',
      'chmod +x /opt/loadtest/bootstrap.sh /opt/loadtest/install-docker-compose.sh /opt/loadtest/verify-couch-auth.sh /opt/loadtest/refresh-couchdb-exporter-env.sh',
      `export COUCHDB_EXPORTER_URL='${config.COUCH_URL}'`,
      `export COUCH_USER='${config.COUCH_USER}'`,
      `export METRICS_FQDN='${metricsFqdn}'`,
      ...(config.COUCH_PASSWORD_SECRET_ARN
        ? [
            `export COUCH_PASSWORD_SECRET_ARN='${config.COUCH_PASSWORD_SECRET_ARN}'`,
          ]
        : [`export COUCH_PASSWORD='${couchPasswordInline}'`]),
      '/opt/loadtest/bootstrap.sh',
      'docker compose version',
      'cd /opt/loadtest',
      'docker compose up -d --force-recreate couchdb-exporter',
      'docker compose up -d',
      `echo "Metrics host ready. Grafana: http://${metricsFqdn}:3030"`
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
      detailedMonitoring: true,
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

    new cdk.CfnOutput(this, 'ContainerInsights', {
      value: config.CONTAINER_INSIGHTS,
      description: 'ECS Container Insights mode (disabled | enabled | enhanced)',
    });

    new cdk.CfnOutput(this, 'CoordinatorLogGroupName', {
      value: coordinatorLogGroup.logGroupName,
      description: 'CloudWatch log group for coordinator tasks',
    });

    new cdk.CfnOutput(this, 'AgentLogGroupName', {
      value: agentLogGroup.logGroupName,
      description: 'CloudWatch log group for agent tasks',
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

    new cdk.CfnOutput(this, 'TargetFaimsAppUrl', {
      value: config.FAIMS_APP_URL,
      description: 'Default FAIMS app URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'TargetFaimsApiUrl', {
      value: config.FAIMS_API_URL,
      description: 'Default FAIMS API URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'TargetCouchUrl', {
      value: config.COUCH_URL,
      description: 'Default Couch URL injected into agent task definition',
    });

    new cdk.CfnOutput(this, 'MetricsBundleS3Uri', {
      value: bundleS3Uri,
      description: 'S3 URI of observability bundle (manual bootstrap recovery)',
      exportName: `${config.STACK_NAME}-MetricsBundleS3Uri`,
    });

    new cdk.CfnOutput(this, 'SequencePlansBucketName', {
      value: sequencePlansBucket.bucketName,
      description:
        'S3 bucket for sequence plan JSON (run-load-test.sh uploads; coordinator reads)',
      exportName: `${config.STACK_NAME}-SequencePlansBucketName`,
    });

    new cdk.CfnOutput(this, 'PushgatewayUrlTemplate', {
      value: `http://<metrics-private-ip>:9091`,
      description:
        'Set PROMETHEUS_PUSHGATEWAY_URL on coordinator overrides after resolving metrics EC2 private IP',
    });
  }
}
