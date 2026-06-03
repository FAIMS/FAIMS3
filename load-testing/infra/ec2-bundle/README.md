# Metrics EC2 bundle

Files uploaded to S3 during `cdk deploy` and extracted to `/opt/loadtest` on the metrics instance.

After connecting via Session Manager:

```bash
cd /opt/loadtest
docker compose up -d
```

Grafana dashboards are copied from `load-testing/observability/` at deploy time. To refresh after local dashboard edits, redeploy the CDK stack.
