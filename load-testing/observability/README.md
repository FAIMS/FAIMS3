# Load Test Observability

Prometheus, Pushgateway, Grafana, and CouchDB exporter configuration for FAIMS load tests.

Start the stack from `load-testing/`:

```bash
cp .env.example .env
make observability
```

Coordinator and agents run separately — see [../README.md](../README.md).

## Stack

| Service | Port (default) | Role |
|---------|----------------|------|
| Prometheus | 9090 | Scrapes coordinator, pushgateway, couchdb-exporter |
| Pushgateway | 9091 | Agent metrics funnel via coordinator |
| Grafana | 3030 | Dashboards (avoids clash with app on 3000) |
| couchdb-exporter | 9984 | CouchDB internal metrics (`gesellix/couchdb-prometheus-exporter`, tag via `COUCHDB_EXPORTER_VERSION`, default `latest`) |

## Dashboard

Provisioned from `grafana/dashboards/json/faims-load-test.json` into folder **FAIMS Load Tests**.

The **CouchDB server load** section charts gesellix exporter metrics for HTTP throughput, read/write rates, errors, Erlang memory, replication, fabric failures, and per-database growth (requires `COUCHDB_EXPORTER_DATABASES=_all_dbs` on the exporter).

After editing panels in Grafana UI, export JSON back:

1. Dashboard → Share → Export → Save to file
2. Replace `grafana/dashboards/json/faims-load-test.json`
3. Or run `make snapshot` before teardown

## Adding metrics

1. Define report type in `@faims3/load-testing-shared` (`MetricReportSchema`)
2. Map to Prometheus name in `metrics.ts` (`metricReportToPrometheusName`)
3. Coordinator `MetricsService.ingestReport` handles histogram/counter/gauge
4. Add Grafana panel querying the new metric

## Prometheus retention

Default 48h in `docker-compose.yml` (`--storage.tsdb.retention.time=48h`).
