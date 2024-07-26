# CloudMap Deregister Lambda

This Lambda function deregisters EC2 instances from AWS CloudMap when they are being terminated by an Auto Scaling group.

## Environment Variables

- `SERVICE_ID`: The ID of the CloudMap service to deregister from.

## Deployment

Deploy this Lambda function using AWS CDK or your preferred deployment method.