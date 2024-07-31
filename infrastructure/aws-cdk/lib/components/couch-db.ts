/*
 * Created Date: Thursday July 25th 2024 Author: Peter Baker
 * -----
 * Last Modified: Thursday July 25th 2024 10:09:45 am Modified By: Peter Baker
 * -----
 * Description: Uses an EC2 instance with some user data to configure
 * a single CouchDB node. Uses a load balancer for TLS. Exposes load balancer to
 * public traffic but not the couchDB directly.
 * -----
 * HISTORY: Date         By  Comments
 * ----------   --- ---------------------------------------------------------
 */

import { Duration, RemovalPolicy, Size } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbTargets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as r53targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { GraphWidget, Metric, TextWidget } from "aws-cdk-lib/aws-cloudwatch";

import { Construct } from "constructs";
import { MonitoringConfig } from "../faims-infra-stack";
import { SharedBalancer } from "./networking";

/**
 * Properties for the EC2CouchDB construct
 */
export interface EC2CouchDBProps {
  /** The VPC to deploy the CouchDB instance in */
  vpc: ec2.IVpc;
  /** The domain name for the CouchDB instance */
  domainName: string;
  /** The shared Application Load Balancer to use */
  sharedBalancer: SharedBalancer;
  /** The Hosted Zone for DNS configuration */
  hz: route53.IHostedZone;
  /** The SSL/TLS certificate for HTTPS connections */
  certificate: acm.ICertificate;
  /** The size of the data volume for CouchDB in GB */
  dataVolumeSize: number;
  /** EBS Snapshot ID for recovery of the CouchDB data volume */
  dataVolumeSnapshotId?: string;
  /** Monitoring settings */
  monitoring?: MonitoringConfig;
}

/**
 * A construct that sets up a CouchDB instance on EC2 with a separate data volume
 */
export class EC2CouchDB extends Construct {
  /** The EC2 instance running CouchDB */
  public readonly instance: ec2.Instance;
  /** The public endpoint for accessing CouchDB */
  public readonly couchEndpoint: string;
  /** The exposed HTTPS port */
  public readonly exposedPort: number = 443;
  /** The secret containing the CouchDB admin user/password */
  public readonly passwordSecret: secretsmanager.Secret;
  /** Shared ALB */
  private readonly sharedBalancer: SharedBalancer;
  /** EC2 Target group */
  private readonly targetGroup: elb.ApplicationTargetGroup;
  /** The internal port CouchDB listens on */
  private readonly couchInternalPort: number = 5984;
  /** The path where CouchDB data will be stored */
  private readonly couchDataPath: string = "/opt/couchdb/data";
  /** The device name for the EBS data volume */
  private readonly ebsDeviceName: string = "/dev/xvdf";
  /** The Couch DB Docker version tag to use  */
  private readonly couchVersionTag: string = "latest";
  /** The device name for the EBS data volume */
  public readonly dataVolume: ec2.Volume;
  /** The Alarm SNS topic being published to */
  private readonly alarmSNSTopic: sns.Topic;
  /** The monitoring config */
  private readonly monitoringConfig?: MonitoringConfig;

  /** CouchDB configuration settings */
  private readonly couchDbConfig: string = `
; CouchDB Configuration Settings for FAIMS
[couchdb]
database_dir = ${this.couchDataPath}
view_index_dir = ${this.couchDataPath}
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

    // Expose variables
    this.sharedBalancer = props.sharedBalancer;
    this.monitoringConfig = props.monitoring;

    // AUXILIARY SETUP
    // ================

    // Create a secret for the CouchDB admin password
    this.passwordSecret = new secretsmanager.Secret(
      this,
      "CouchDBAdminPassword",
      {
        generateSecretString: {
          excludeCharacters: '/\\"%@',
          generateStringKey: "password",
          passwordLength: 16,
          secretStringTemplate: JSON.stringify({ username: "admin" }),
        },
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    // INSTANCE CONFIG
    // ================

    // Create user data script to install and configure CouchDB
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "set -e",
      "exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1",

      // Update yum and install dependencies
      "yum update -y",

      // Collectd for cloudwatch agent
      "sudo amazon-linux-extras install collectd",

      "yum install -y docker jq awscli amazon-cloudwatch-agent",

      // Configure CloudWatch agent to collect disk usage and memory usage -
      // publish 60 second interval
      "cat > /opt/aws/amazon-cloudwatch-agent/bin/config.json <<EOL",
      `
{
   "agent":{
      "metrics_collection_interval":60,
      "run_as_user":"root"
   },
   "metrics":{
      "aggregation_dimensions":[
         [
            "InstanceId"
         ]
      ],
      "append_dimensions":{
         "AutoScalingGroupName":"\${aws:AutoScalingGroupName}",
         "ImageId":"\${aws:ImageId}",
         "InstanceId":"\${aws:InstanceId}",
         "InstanceType":"\${aws:InstanceType}"
      },
      "metrics_collected":{
         "cpu":{
            "measurement":[
               "cpu_usage_idle",
               "cpu_usage_iowait",
               "cpu_usage_user",
               "cpu_usage_system"
            ],
            "metrics_collection_interval":60,
            "resources":[
               "*"
            ],
            "totalcpu":false
         },
         "disk":{
            "measurement":[
               "used_percent",
               "inodes_free"
            ],
            "metrics_collection_interval":60,
            "resources":[
               "*"
            ]
         },
         "diskio":{
            "measurement":[
               "io_time"
            ],
            "metrics_collection_interval":60,
            "resources":[
               "*"
            ]
         },
         "mem":{
            "measurement":[
               "mem_used_percent"
            ],
            "metrics_collection_interval":60
         },
         "swap":{
            "measurement":[
               "swap_used_percent"
            ],
            "metrics_collection_interval":60
         }
      }
   }
}
      `,
      "EOL",

      // Validate and load config
      "/opt/aws/amazon-cloudwatch-agent/amazon-cloudwatch-agent-ctl -m ec2 -a fetch-config -c /opt/aws/amazon-cloudwatch-agent/bin/config.json",

      // Start the service (this creates auto start systemd service)
      "/opt/aws/amazon-cloudwatch-agent/amazon-cloudwatch-agent-ctl -m ec2 -a start -c /opt/aws/amazon-cloudwatch-agent/bin/config.json",

      // Run CouchDB with docker service
      "systemctl start docker",
      "systemctl enable docker",
      "docker pull couchdb:latest",

      // Set environment variables
      `SECRET_ARN=${this.passwordSecret.secretArn}`,
      "REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
      "export AWS_DEFAULT_REGION=$REGION",

      // Get username and password from Secrets Manager
      "ADMIN_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text | jq -r .password)",
      "ADMIN_USER=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text | jq -r .username)",

      // Create CouchDB configuration file
      "mkdir -p /opt/couchdb/etc/local.d",
      `cat > /opt/couchdb/etc/local.d/local.ini << EOL
${this.couchDbConfig}
EOL`,

      // Append admin and password configuration to local.ini
      `echo "[admins]" >> /opt/couchdb/etc/local.d/local.ini`,
      `echo "$ADMIN_USER = $ADMIN_PASSWORD" >> /opt/couchdb/etc/local.d/local.ini`,

      // Mount the EBS volume for CouchDB data
      `DEVICE=${this.ebsDeviceName}`,
      `DATA_DIR=${this.couchDataPath}`,

      // Check if the volume has a filesystem - in snapshot it already will!
      "if ! blkid $DEVICE; then",
      "    # If not, create an ext4 filesystem",
      "    mkfs -t ext4 $DEVICE",
      "fi",

      // Create the mount point
      "mkdir -p $DATA_DIR",

      // Mount the volume
      "mount $DEVICE $DATA_DIR",

      // Add to fstab for persistence across reboots
      'echo "$DEVICE $DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab',

      // Set appropriate permissions
      "chown -R 5984:5984 $DATA_DIR",

      // Log the result
      'echo "CouchDB data volume mounted at $DATA_DIR" >> /var/log/couchdb-setup.log',

      // Create a systemd service file for CouchDB
      `cat > /etc/systemd/system/couchdb-docker.service << EOL
[Unit]
Description=CouchDB Docker Container
Requires=docker.service
After=docker.service

[Service]
Restart=always
ExecStart=/usr/bin/docker run --rm --name couchdb -p 5984:5984 -v /opt/couchdb/etc/local.d:/opt/couchdb/etc/local.d -v ${this.couchDataPath}:${this.couchDataPath} couchdb:${this.couchVersionTag}
ExecStop=/usr/bin/docker stop couchdb

[Install]
WantedBy=multi-user.target
EOL`,

      // Reload systemd to recognize the new service
      "systemctl daemon-reload",

      // Enable and start the CouchDB service
      "systemctl enable couchdb-docker.service",
      "systemctl start couchdb-docker.service",

      // Log the result
      'echo "CouchDB Docker service created and started" >> /var/log/couchdb-setup.log'
    );

    // INSTANCE SETUP
    // ================

    // Create a security group for the EC2 instance
    const couchSecurityGroup = new ec2.SecurityGroup(
      this,
      "CouchDBSecurityGroup",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: "Security group for CouchDB EC2 instances",
      }
    );

    // Create the EC2 instance
    this.instance = new ec2.Instance(this, "CouchDBInstance", {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: couchSecurityGroup,
    });

    // Create and attach the EBS volume for CouchDB data
    const dataVolume = new ec2.Volume(this, "CouchDBDataVolume", {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      availabilityZone: this.instance.instanceAvailabilityZone,

      // provide either a size OR a recovery snapshot ID
      size: props.dataVolumeSnapshotId
        ? undefined
        : Size.gibibytes(props.dataVolumeSize),
      snapshotId: props.dataVolumeSnapshotId,
    });

    // Attach the EBS data volume for couch to the correct path
    new ec2.CfnVolumeAttachment(this, "CouchDBVolumeAttachment", {
      volumeId: dataVolume.volumeId,
      instanceId: this.instance.instanceId,
      device: this.ebsDeviceName,
    });

    // LOAD BALANCING SETUP
    // =========================

    // Create the target group for the CouchDB instances
    this.targetGroup = new elb.ApplicationTargetGroup(this, "CouchTG", {
      port: this.couchInternalPort,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.INSTANCE,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: "200",
        protocol: elb.Protocol.HTTP,
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        port: this.couchInternalPort.toString(),
        path: "/",
      },
      vpc: props.vpc,
    });

    // Add the EC2 instance to the target group
    this.targetGroup.addTarget(new elbTargets.InstanceTarget(this.instance));

    // Add HTTP redirected HTTPS service to ALB against target group
    props.sharedBalancer.addHttpRedirectedConditionalHttpsTarget(
      "couch",
      this.targetGroup,
      [elb.ListenerCondition.hostHeaders([props.domainName])],
      110, // TODO: Understand and consider priorities
      110
    );

    // DNS ROUTES
    // ===========

    // Create a DNS record for the CouchDB endpoint
    new route53.ARecord(this, "CouchDBAliasRecord", {
      zone: props.hz,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new r53targets.LoadBalancerTarget(props.sharedBalancer.alb)
      ),
    });

    // DEBUG CONFIG
    // ============

    // TODO: Handle this through config
    const debugInstancePermissions = true;

    if (debugInstancePermissions) {
      // For debugging CouchDB instances - allow inbound traffic for SSM Instance Connect
      couchSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443),
        "Allow SSM Instance Connect"
      );

      // Add SSM Instance Connect permissions to the instance role
      this.instance.role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        )
      );
    }

    // IAM PERMISSIONS
    // ==================

    // Grant the EC2 instance permission to read the secret
    this.passwordSecret.grantRead(this.instance.role);

    // Add necessary permissions for CloudWatch agent
    this.instance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
    );

    // NETWORK SECURITY
    // ================

    // Allow inbound traffic from the ALB to the CouchDB instances
    couchSecurityGroup.connections.allowFrom(
      props.sharedBalancer.alb,
      ec2.Port.tcp(this.couchInternalPort),
      "Allow traffic from ALB to CouchDB instances"
    );

    // MONITORING
    // ==========

    // Create an SNS topic for alarms
    this.alarmSNSTopic = new sns.Topic(this, "CouchDBAlarmTopic", {
      displayName: "CouchDB Alarms",
    });

    // If an email is provided, add an email subscription to the SNS topic
    if (this.monitoringConfig?.alarmTopic?.emailAddress) {
      this.alarmSNSTopic.addSubscription(
        new subscriptions.EmailSubscription(
          this.monitoringConfig.alarmTopic.emailAddress
        )
      );
    }

    // Set up monitoring
    this.setupMonitoring();

    // Setup dashboard
    this.createDashboard();

    // OUTPUTS
    // ================

    // Set the public endpoint for CouchDB
    this.couchEndpoint = `https://${props.domainName}:${this.exposedPort}`;
    this.dataVolume = dataVolume;
  }

  /**
   * Sets up a set of reasonable metrics which alarm an SNS topic for which an
   * email is optionally subscribed.
   *
   * TODO: Parameterise key metric thresholds into config
   */
  private setupMonitoring() {
    // CPU Utilization Alarm
    this.createAlarm("CouchDBCPUAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "CPUUtilization",
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: "Average",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.cpu?.threshold ?? 80,
      evaluationPeriods: this.monitoringConfig?.cpu?.evaluationPeriods ?? 3,
      datapointsToAlarm: this.monitoringConfig?.cpu?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance CPU utilization is high",
    });

    // Memory Usage Alarm
    this.createAlarm("CouchDBMemoryAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "CWAgent",
        metricName: "mem_used_percent",
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: "Average",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.memory?.threshold ?? 80,
      evaluationPeriods: this.monitoringConfig?.memory?.evaluationPeriods ?? 3,
      datapointsToAlarm: this.monitoringConfig?.memory?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance memory usage is high",
    });

    // Disk Usage Alarm
    this.createAlarm("CouchDBDiskAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "CWAgent",
        metricName: "disk_used_percent",
        dimensionsMap: {
          InstanceId: this.instance.instanceId,
          path: "/",
        },
        statistic: "Average",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.disk?.threshold ?? 80,
      evaluationPeriods: this.monitoringConfig?.disk?.evaluationPeriods ?? 3,
      datapointsToAlarm: this.monitoringConfig?.disk?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance disk usage is high",
    });

    // Status Check Failed Alarm
    this.createAlarm("CouchDBStatusCheckAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "StatusCheckFailed",
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: "Maximum",
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods:
        this.monitoringConfig?.statusCheck?.evaluationPeriods ?? 2,
      datapointsToAlarm:
        this.monitoringConfig?.statusCheck?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance has failed its status check",
    });

    // Network In Alarm
    this.createAlarm("CouchDBNetworkInAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "NetworkIn",
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: "Average",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.networkIn?.threshold ?? 10000000, // 10 MB/s
      evaluationPeriods:
        this.monitoringConfig?.networkIn?.evaluationPeriods ?? 3,
      datapointsToAlarm:
        this.monitoringConfig?.networkIn?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance network in is high",
    });

    // Network Out Alarm
    this.createAlarm("CouchDBNetworkOutAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "NetworkOut",
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: "Average",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.networkOut?.threshold ?? 10000000, // 10 MB/s
      evaluationPeriods:
        this.monitoringConfig?.networkOut?.evaluationPeriods ?? 3,
      datapointsToAlarm:
        this.monitoringConfig?.networkOut?.datapointsToAlarm ?? 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB instance network out is high",
    });

    // HTTP 5xx Errors Alarm
    this.createAlarm("CouchDBHttp5xxAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "HTTPCode_Target_5XX_Count",
        dimensionsMap: {
          LoadBalancer: this.sharedBalancer.alb.loadBalancerFullName,
          TargetGroup: this.targetGroup.targetGroupFullName,
        },
        statistic: "Sum",
        period: Duration.minutes(5),
      }),
      threshold: this.monitoringConfig?.http5xx?.threshold ?? 10,
      evaluationPeriods: this.monitoringConfig?.http5xx?.evaluationPeriods ?? 5,
      datapointsToAlarm: this.monitoringConfig?.http5xx?.datapointsToAlarm ?? 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CouchDB is returning a high number of 5xx errors",
    });
  }

  /**
   * Creates a new alarm referring to the configured SNS topic etc
   * @param id The CDK construct ID
   * @param props The cloud watch alarm props
   */
  private createAlarm(id: string, props: cloudwatch.AlarmProps) {
    const alarm = new cloudwatch.Alarm(this, id, props);
    alarm.addAlarmAction(new cw_actions.SnsAction(this.alarmSNSTopic));
  }

  /**
   * Build a CloudWatch dashboard with the relevant metrics for couchDB
   */
  private createDashboard() {
    const dashboard = new cloudwatch.Dashboard(this, "CouchDBDashboard", {
      dashboardName: "CouchDB-Dashboard",
    });

    const instanceId = this.instance.instanceId;
    const albFullName = this.sharedBalancer.alb.loadBalancerFullName;
    const targetGroupFullName = this.targetGroup.targetGroupFullName;

    dashboard.addWidgets(
      new TextWidget({
        markdown: "# CouchDB Instance Metrics",
        width: 24,
        height: 1,
      }),
      new GraphWidget({
        title: "CPU Utilization",
        left: [
          new Metric({
            namespace: "AWS/EC2",
            metricName: "CPUUtilization",
            dimensionsMap: { InstanceId: instanceId },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "Memory Usage",
        left: [
          new Metric({
            namespace: "CWAgent",
            metricName: "mem_used_percent",
            dimensionsMap: { InstanceId: instanceId },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "Disk Usage",
        left: [
          new Metric({
            namespace: "CWAgent",
            metricName: "disk_used_percent",
            dimensionsMap: { InstanceId: instanceId, path: "/" },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "Network Traffic",
        left: [
          new Metric({
            namespace: "AWS/EC2",
            metricName: "NetworkIn",
            dimensionsMap: { InstanceId: instanceId },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        right: [
          new Metric({
            namespace: "AWS/EC2",
            metricName: "NetworkOut",
            dimensionsMap: { InstanceId: instanceId },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: "Status Check Failed",
        left: [
          new Metric({
            namespace: "AWS/EC2",
            metricName: "StatusCheckFailed",
            dimensionsMap: { InstanceId: instanceId },
            statistic: "Maximum",
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new TextWidget({
        markdown: "# Application Load Balancer Metrics",
        width: 24,
        height: 1,
      }),
      new GraphWidget({
        title: "ALB Request Count",
        left: [
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "RequestCount",
            dimensionsMap: { LoadBalancer: albFullName },
            statistic: "Sum",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "ALB Target Response Time",
        left: [
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "TargetResponseTime",
            dimensionsMap: { LoadBalancer: albFullName },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "ALB HTTP Error Codes",
        left: [
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "HTTPCode_Target_4XX_Count",
            dimensionsMap: {
              LoadBalancer: albFullName,
              TargetGroup: targetGroupFullName,
            },
            statistic: "Sum",
            period: Duration.minutes(5),
          }),
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "HTTPCode_Target_5XX_Count",
            dimensionsMap: {
              LoadBalancer: albFullName,
              TargetGroup: targetGroupFullName,
            },
            statistic: "Sum",
            period: Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: "ALB Healthy Host Count",
        left: [
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "HealthyHostCount",
            dimensionsMap: {
              LoadBalancer: albFullName,
              TargetGroup: targetGroupFullName,
            },
            statistic: "Average",
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: "ALB Processed Bytes",
        left: [
          new Metric({
            namespace: "AWS/ApplicationELB",
            metricName: "ProcessedBytes",
            dimensionsMap: { LoadBalancer: albFullName },
            statistic: "Sum",
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      })
    );
  }
}
