.PHONY: observability down snapshot build-coordinator build-agent

include .env
export

observability:
	chmod -R a+rX observability
	chmod +x scripts/generate-couchdb-exporter-env.sh
	./scripts/generate-couchdb-exporter-env.sh
	docker compose up -d
	./scripts/wait-for-healthy.sh
	@echo "Observability stack running. Grafana: http://localhost:$(GRAFANA_PORT:-3030)"

down:
	docker compose down -v

snapshot:
	./scripts/snapshot-grafana.sh

build-coordinator:
	cd .. && docker build -f load-testing/coordinator/Dockerfile -t load-test-coordinator .

build-agent:
	cd .. && docker build -f load-testing/agents/Dockerfile -t load-test-agent .
