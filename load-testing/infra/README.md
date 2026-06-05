# Load testing AWS infrastructure (CDK)

On-demand AWS resources for DASS load tests:

| Component | AWS resource | Lifecycle |
|-----------|--------------|-----------|
| Observability (Prometheus, Grafana, Pushgateway, couchdb-exporter) | EC2 + EIP + Route53 | Start/stop instance; compose via SSM |
| Sequence plans | S3 bucket | Plans uploaded per run by `run-load-test.sh` |
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
3. Create an **S3 bucket** for sequence plan JSON (coordinator task role: read; your CLI user: upload via `run-load-test.sh`)
4. Launch metrics EC2 with observability bundle in `/opt/loadtest`
5. Create EIP + Route53 A record (`METRICS_SUBDOMAIN.HOSTED_ZONE_NAME`)

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
| `SequencePlansBucketName` | Upload local plan JSON; coordinator reads via `SEQUENCE_PLAN_S3_URI` |

## Sequence plan S3 bucket

The coordinator does not receive large plan JSON through ECS environment variables (8192-byte limit per value). Instead:

1. `run-load-test.sh` reads `SEQUENCE_PLAN_FILE` from your laptop
2. Uploads to `s3://<SequencePlansBucketName>/plans/<filename>.json`
3. Passes `SEQUENCE_PLAN_S3_URI` to the coordinator RunTask override
4. Coordinator fetches and validates the plan at startup using its task IAM role

To use a pre-uploaded object, set `SEQUENCE_PLAN_S3_URI` in `scripts/.env` and skip the file path.

## Observability stack

EC2 user-data installs Docker, downloads the bundle to `/opt/loadtest`, runs `bootstrap.sh` (writes `.env`), and starts `docker compose up -d`. Grafana is available at `http://<MetricsDnsName>:3030` once the instance finishes booting.

To restart after a compose change:

```bash
cd /opt/loadtest
docker compose up -d
```

If bootstrap or compose failed (check `sudo tail -100 /var/log/cloud-init-output.log`), recover manually:

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
cd /opt/loadtest && docker compose up -d
```

Couch passwords with `$` must not live in project `.env` (compose auto-loads it). If the exporter shows a truncated password, run:

```bash
export COUCH_PASSWORD_SECRET_ARN='arn:aws:secretsmanager:…'
sudo -E /opt/loadtest/refresh-couchdb-exporter-env.sh
cd /opt/loadtest && docker compose up -d --force-recreate couchdb-exporter
```

Or terminate the metrics EC2 instance and redeploy after a CDK update (user-data runs again on new instance).

Grafana: `http://<MetricsDnsName>:3030`

## Metrics pipeline (AWS vs local)

| Metric | Local dev | AWS |
|--------|-----------|-----|
| Run state, agent counts | Prometheus scrapes `host.docker.internal:4000/metrics` | Coordinator **pushes** job `dass_coordinator` to Pushgateway |
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
curl -s 'localhost:9090/api/v1/query?query=dass_run_state' | jq '.data.result'
```

**CloudWatch logs** (separate log groups — do not mix coordinator and agent):

| Output | Contents |
|--------|----------|
| `CoordinatorLogGroupName` | Coordinator RunTask (`[coordinator] …`) |
| `AgentLogGroupName` | Agent RunTasks (`[worker]`, `[session …]`) — stream `agent/agent/<task-id>` per task |

```bash
cd load-testing/scripts
./tail-agent-logs.sh          # follow latest agent stream
./tail-agent-logs.sh --list   # list recent agent streams
```

Coordinator logs: search for `Pushgateway coordinator push failed` or `Pushgateway push failed`.

## Run a load test

```bash
cd load-testing/scripts
cp .env.example .env
# Edit AGENT_COUNT, LOAD_TEST_ACCOUNTS, notebook IDs, STACK_NAME, AWS_REGION, SEQUENCE_PLAN_FILE

./run-load-test.sh
```

The script loads `load-testing/scripts/.env`, reads CloudFormation stack outputs, then:

1. Resolves metrics EC2 private IP → `PROMETHEUS_PUSHGATEWAY_URL`
2. Uploads sequence plan to S3 (unless `SEQUENCE_PLAN_S3_URI` or `SEQUENCE_PLAN_DELIVERY=env`)
3. `run-task` coordinator with `EXPECTED_AGENT_COUNT` and `SEQUENCE_PLAN_S3_URI`
4. Waits for `/health`, discovers coordinator public IP
5. `run-task` N agents with `COORDINATOR_URL` and scenario env overrides
6. Waits for coordinator task to stop

## Tear down

```bash
pnpm run destroy
```

Stop metrics EC2 separately if you want to keep the stack but pause costs. The sequence-plans bucket is destroyed with the stack (`autoDeleteObjects` enabled).

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
  .env.example              # Run config (stack name, agents, plan file, etc.)
```
