package auth

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const MetadataKey = "x-export-service-secret"

func CheckSecret(expected string, md metadata.MD) error {
	if expected == "" {
		return nil
	}
	if md == nil {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}
	values := md.Get(MetadataKey)
	if len(values) == 0 || values[0] != expected {
		return status.Error(codes.Unauthenticated, "invalid export service secret")
	}
	return nil
}
