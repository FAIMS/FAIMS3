# Load testing AWS infrastructure (CDK)

On-demand AWS resources for DASS load tests:

| Component | AWS resource | Lifecycle |
|-----------|--------------|-----------|
| Observability (Prometheus, Grafana, Pushgateway, couchdb-exporter) | EC2 + EIP + Route53 | Start/stop instance; compose via SSM |
| Coordinator | ECS Fargate **RunTask** | Exits when test completes |
| Agents | ECS Fargate **RunTask** × N | One task per worker |

## Prerequisites

- Node.js 22, pnpm, Docker (for `cdk deploy` image builds)
- AWS CLI v2, `jq`, `curl`
- CDK bootstrapped in target account/region
- Route53 hosted zone for metrics subdomain

## Configure

```bash
cd load-testing/infra
cp .env.example .env
# Edit stack name, account, region, hosted zone, DEV URLs, couch secret ARN
```

All variables are validated at synth time with **Zod** (`lib/config.ts`).

## Deploy infrastructure

```bash
pnpm install
pnpm run deploy
```

This will:

1. Build and push **coordinator** and **agent** Docker images (scoped `.dockerignore` excludes via `DOCKER_ASSET_EXCLUDES`)
2. Create VPC, ECS cluster, task definitions (no services)
3. Launch metrics EC2 with observability bundle in `/opt/loadtest`
4. Create EIP + Route53 A record (`METRICS_SUBDOMAIN.HOSTED_ZONE_NAME`)

### Stack outputs

| Output | Used for |
|--------|----------|
| `CoordinatorTaskDefinitionArn` | `run-load-test.sh` |
| `AgentTaskDefinitionArn` | `run-load-test.sh` |
| `ClusterName` | `run-load-test.sh` |
| `PublicSubnetIds` | awsvpc network config |
| `EcsSecurityGroupId` | awsvpc network config |
| `MetricsInstanceId` | Resolve pushgateway private IP |
| `MetricsDnsName` | Grafana URL |

## Start observability (manual)

Connect via **Session Manager** to the metrics EC2 instance, then:

```bash
cd /opt/loadtest
docker compose up -d
```

User-data installs the bundle and writes `/opt/loadtest/.env` (couch exporter URL + password from Secrets Manager when configured).

Grafana: `http://<MetricsDnsName>:3030`

## Run a load test

```bash
./scripts/run-load-test.sh \
  --stack loadtest-dev \
  --region ap-southeast-2 \
  --agents 10 \
  --invite DEV-XXXXXX \
  --notebook-project-id your-project-id \
  --notebook-server-id development-faims-server
```

The script:

1. Reads CloudFormation outputs
2. Resolves metrics EC2 private IP → `PROMETHEUS_PUSHGATEWAY_URL`
3. `run-task` coordinator with `EXPECTED_AGENT_COUNT`
4. Waits for `/health`, discovers coordinator public IP
5. `run-task` N agents with `COORDINATOR_URL` and scenario env overrides
6. Waits for coordinator task to stop

## Tear down

```bash
pnpm run destroy
```

Stop metrics EC2 separately if you want to keep the stack but pause costs.

## Layout

```
infra/
  bin/load-test-infra.ts    # CDK app entry (loads .env)
  lib/config.ts             # Zod config
  lib/load-test-stack.ts    # Stack definition
  ec2-bundle/               # Uploaded to metrics EC2 via S3 asset
  scripts/run-load-test.sh  # RunTask helper
  .env.example
```
