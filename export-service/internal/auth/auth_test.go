package auth

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestCheckSecretAllowsWhenUnset(t *testing.T) {
	if err := CheckSecret("", metadata.Pairs(MetadataKey, "anything")); err != nil {
		t.Fatalf("expected open access when secret unset, got %v", err)
	}
}

func TestCheckSecretRejectsMissingMetadata(t *testing.T) {
	err := CheckSecret("secret", nil)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", err)
	}
}

func TestCheckSecretRejectsWrongSecret(t *testing.T) {
	err := CheckSecret("secret", metadata.Pairs(MetadataKey, "wrong"))
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", err)
	}
}

func TestCheckSecretAcceptsMatchingSecret(t *testing.T) {
	if err := CheckSecret("secret", metadata.Pairs(MetadataKey, "secret")); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}
