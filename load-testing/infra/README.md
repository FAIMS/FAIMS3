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
| `CoordinatorTaskDefinitionArn` | `scripts/run-load-test.sh` |
| `AgentTaskDefinitionArn` | `scripts/run-load-test.sh` |
| `ClusterName` | `scripts/run-load-test.sh` |
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

User-data installs Docker, downloads the bundle from S3 to `/opt/loadtest`, and runs `bootstrap.sh` (writes `.env`). If bootstrap failed (check `sudo tail -100 /var/log/cloud-init-output.log`), recover manually:

```bash
# On your laptop — get bundle URI from stack output MetricsBundleS3Uri
# On the instance:
sudo dnf clean all
sudo dnf install -y docker jq unzip
sudo systemctl enable --now docker
sudo mkdir -p /opt/loadtest
sudo aws s3 cp 's3://…' /tmp/loadtest-bundle.zip   # MetricsBundleS3Uri
sudo unzip -o /tmp/loadtest-bundle.zip -d /opt/loadtest
sudo chmod +x /opt/loadtest/bootstrap.sh
export COUCHDB_EXPORTER_URL='https://couchdb.your.domain'
export COUCH_USER='admin'
export COUCH_PASSWORD_SECRET_ARN='arn:aws:secretsmanager:…'
sudo -E /opt/loadtest/bootstrap.sh
cd /opt/loadtest && sudo docker compose up -d
```

Or terminate the metrics EC2 instance and redeploy after a CDK update (user-data runs again on new instance).

Grafana: `http://<MetricsDnsName>:3030`

## Metrics pipeline (AWS vs local)

| Metric | Local dev | AWS |
|--------|-----------|-----|
| Phase (`dass_test_phase`, agent counts) | Prometheus scrapes `host.docker.internal:4000/metrics` | Coordinator **pushes** job `dass_coordinator` to Pushgateway |
| Agent timings (record create, sync, …) | Coordinator pushes job `dass_agent_metrics` to Pushgateway | Same |

Prometheus on metrics EC2 only scrapes **Pushgateway** and **couchdb-exporter** (not the ephemeral coordinator task).

If Grafana panels are empty after a successful run:

```bash
cd load-testing/scripts
COORDINATOR_URL=http://<coord-public-ip>:4000 ./debug-metrics.sh
```

On the metrics EC2 instance (SSM):

```bash
curl -s localhost:9091/metrics | grep '^dass_' | head
curl -s 'localhost:9090/api/v1/query?query=dass_test_phase' | jq '.data.result'
```

Coordinator CloudWatch logs: search for `Pushgateway coordinator push failed` or `Pushgateway push failed`.

## Run a load test

```bash
cd load-testing/scripts
cp .env.example .env
# Edit AGENT_COUNT, INVITE_CODE, notebook IDs, STACK_NAME, AWS_REGION

./run-load-test.sh
```

The script loads `load-testing/scripts/.env`, reads CloudFormation stack outputs, then:

1. Resolves metrics EC2 private IP → `PROMETHEUS_PUSHGATEWAY_URL`
2. `run-task` coordinator with `EXPECTED_AGENT_COUNT`
3. Waits for `/health`, discovers coordinator public IP
4. `run-task` N agents with `COORDINATOR_URL` and scenario env overrides
5. Waits for coordinator task to stop

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
  .env.example              # CDK deploy config

../scripts/
  run-load-test.sh          # RunTask helper (.env driven)
  .env.example              # Run config (stack name, agents, invite, etc.)
```
