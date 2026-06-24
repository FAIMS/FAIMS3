FROM golang:1.25-alpine AS builder

WORKDIR /src
COPY export-service/go.mod export-service/go.sum* ./export-service/
WORKDIR /src/export-service
RUN go mod download

WORKDIR /src
COPY export-service ./export-service
WORKDIR /src/export-service
RUN CGO_ENABLED=0 go build -o /out/export-service ./cmd/export-service

FROM alpine:3.22
COPY --from=builder /out/export-service /usr/local/bin/export-service
EXPOSE 9090
ENTRYPOINT ["/usr/local/bin/export-service"]
