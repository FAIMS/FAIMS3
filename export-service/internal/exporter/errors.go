package exporter

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	ErrInvalidArgument  = errors.New("invalid argument")
	ErrNotFound         = errors.New("not found")
	ErrPermissionDenied = errors.New("permission denied")
	ErrUnavailable      = errors.New("unavailable")
)

type invalidArgumentError struct {
	msg string
}

func (e *invalidArgumentError) Error() string { return e.msg }
func (e *invalidArgumentError) Unwrap() error { return ErrInvalidArgument }

func invalidArgumentf(format string, args ...any) error {
	return &invalidArgumentError{msg: fmt.Sprintf(format, args...)}
}

type notFoundError struct {
	msg string
}

func (e *notFoundError) Error() string { return e.msg }
func (e *notFoundError) Unwrap() error { return ErrNotFound }

func notFoundf(format string, args ...any) error {
	return &notFoundError{msg: fmt.Sprintf(format, args...)}
}

type CouchDBError struct {
	StatusCode int
	Method     string
	Path       string
	Body       string
}

func (e *CouchDBError) Error() string {
	return fmt.Sprintf("couchdb %s %s failed: %d %s", e.Method, e.Path, e.StatusCode, strings.TrimSpace(e.Body))
}

func (e *CouchDBError) Unwrap() error {
	switch e.StatusCode {
	case 401, 403:
		return ErrPermissionDenied
	case 404:
		return ErrNotFound
	default:
		if e.StatusCode >= 500 {
			return ErrUnavailable
		}
		return nil
	}
}

func mapToGRPCCode(err error) codes.Code {
	if err == nil {
		return codes.OK
	}
	if errors.Is(err, context.Canceled) {
		return codes.Canceled
	}
	switch {
	case errors.Is(err, ErrInvalidArgument):
		return codes.InvalidArgument
	case errors.Is(err, ErrNotFound):
		return codes.NotFound
	case errors.Is(err, ErrPermissionDenied):
		return codes.PermissionDenied
	case errors.Is(err, ErrUnavailable):
		return codes.Unavailable
	}

	var couchErr *CouchDBError
	if errors.As(err, &couchErr) {
		return mapToGRPCCode(couchErr)
	}

	if isTimeoutOrConnection(err) {
		return codes.Unavailable
	}

	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "is required") || strings.Contains(msg, "unsupported export format") || strings.Contains(msg, "invalid form") {
		return codes.InvalidArgument
	}
	if strings.Contains(msg, "not found") {
		return codes.NotFound
	}

	return codes.Internal
}

func toGRPCStatus(err error) error {
	if err == nil {
		return nil
	}
	return status.Error(mapToGRPCCode(err), err.Error())
}

// ToGRPCStatus maps exporter errors to gRPC status codes for the server layer.
func ToGRPCStatus(err error) error {
	return toGRPCStatus(err)
}

func isTimeoutOrConnection(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "no such host") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "context deadline exceeded")
}
