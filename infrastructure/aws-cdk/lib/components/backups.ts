import { Construct } from "constructs";
import * as backup from "aws-cdk-lib/aws-backup";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

/**
 * Properties for the AwsBackupConstruct
 */
export interface BackupProps {
  /**
   * The name of the backup vault to create or use
   */
  backupVaultName: string;
  /**
   * The number of days to retain backups (default: 30)
   */
  backupRetentionDays?: number;
  /**
   * The ARN of an existing backup vault to use (optional)
   * If provided, a new vault will not be created
   */
  existingBackupVaultArn?: string;
  /**
   * The cron schedule expression to be used for running the backup e.g. cron(...)
   */
  scheduleExpression: events.Schedule;
}

/**
 * A construct that creates an AWS Backup plan and associated resources
 */
export class BackupConstruct extends Construct {
  /**
   * The AWS Backup vault used for storing backups
   */
  private backupVault: backup.IBackupVault;

  /**
   * The AWS Backup plan that defines the backup rules
   */
  private backupPlan: backup.BackupPlan;

  /**
   * The IAM role used by AWS Backup to perform backup operations
   */
  private backupRole: iam.Role;

  /**
   * Creates a new AwsBackupConstruct
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties for the AwsBackupConstruct
   */
  constructor(scope: Construct, id: string, props: BackupProps) {
    super(scope, id);

    // Determine whether to create a new vault or use an existing one
    if (props.existingBackupVaultArn) {
      // Use the existing backup vault
      this.backupVault = backup.BackupVault.fromBackupVaultArn(
        this,
        "ExistingBackupVault",
        props.existingBackupVaultArn
      );
    } else {
      // Create a new backup vault
      this.backupVault = new backup.BackupVault(this, "BackupVault", {
        backupVaultName: props.backupVaultName,
        removalPolicy: RemovalPolicy.RETAIN, // Retain the vault even if the stack is destroyed
      });
    }

    // Create the backup plan
    this.backupPlan = new backup.BackupPlan(this, "BackupPlan", {});

    // Add a rule to the backup plan
    this.backupPlan.addRule(
      new backup.BackupPlanRule({
        completionWindow: Duration.hours(2), // Time window for backup completion
        startWindow: Duration.hours(1), // Time window for backup to start
        scheduleExpression: props.scheduleExpression, // Run daily at 3am
        deleteAfter: Duration.days(props.backupRetentionDays || 30), // Retention period
        backupVault: this.backupVault,
      })
    );

    // Create an IAM role for AWS Backup
    this.backupRole = new iam.Role(this, "BackupRole", {
      assumedBy: new iam.ServicePrincipal("backup.amazonaws.com"),
    });

    // Attach the necessary policy to the role
    this.backupRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSBackupServiceRolePolicyForBackup"
      )
    );
  }

  /**
   * Registers an EC2 instance to be backed up by this backup plan
   * @param instance The EC2 instance to register for backups
   */
  public registerEc2Instance(instance: ec2.Instance, label?: string) {
    // Add the instance to the backup plan's selection
    this.backupPlan.addSelection(`${label ?? (instance.node.id + "Selection")}`, {
      resources: [backup.BackupResource.fromEc2Instance(instance)],
    });
  }
}
