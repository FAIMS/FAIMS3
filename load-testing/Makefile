.PHONY: test clean snapshot prepare-invites build

include .env
export

AGENT_COUNT ?= 1

build:
	cd .. && pnpm build-load-testing

test: build
	docker compose up -d prometheus pushgateway grafana couchdb-exporter
	./scripts/wait-for-healthy.sh "prometheus pushgateway grafana couchdb-exporter"
	docker compose up -d coordinator
	./scripts/wait-for-coordinator.sh
	docker compose up --scale agent=$(AGENT_COUNT) agent
	@echo "Test running. Dashboard: http://localhost:$(GRAFANA_PORT:-3030)"
	docker compose wait agent || true
	@echo "Test complete."

clean:
	docker compose down -v

snapshot:
	./scripts/snapshot-grafana.sh

prepare-invites:
	@echo "Create a multi-use project invite in the web admin with usesOriginal >= AGENT_COUNT * SESSIONS_PER_AGENT"
	@echo "Set INVITE_CODE in .env to the invite short code (e.g. DEV-ABC123)"
