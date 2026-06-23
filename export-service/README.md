# FAIMS export service

Go gRPC microservice for streaming FAIMS notebook exports.

The existing Conductor Express API keeps authentication, download-token
validation, and HTTP response headers. When `EXPORT_SERVICE_GRPC_ADDRESS` is
configured in the API, Conductor calls this service over gRPC and pipes streamed
file chunks directly to the browser response.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `EXPORT_GRPC_ADDR` | `:9090` | Address the gRPC server listens on. |
| `COUCHDB_INTERNAL_URL` | `http://localhost:5984` | Internal CouchDB base URL. |
| `COUCHDB_USER` | `admin` | CouchDB username. |
| `COUCHDB_PASSWORD` | `password` | CouchDB password. |

## Development

```bash
cd export-service
go test ./...
go run ./cmd/export-service
```

The protobuf contract is shared at `../proto/export.proto`; generated Go
bindings are committed under `internal/pb` so normal builds do not need protoc.
