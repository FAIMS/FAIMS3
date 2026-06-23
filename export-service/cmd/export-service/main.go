package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"os"
	"strconv"

	"github.com/faims/faims3/export-service/internal/auth"
	"github.com/faims/faims3/export-service/internal/exporter"
	"github.com/faims/faims3/export-service/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/metadata"
)

type exportServer struct {
	pb.UnimplementedExportServiceServer
	exporter   *exporter.Exporter
	secret     string
	chunkBytes int
}

func (s *exportServer) checkAuth(ctx context.Context) error {
	md, _ := metadata.FromIncomingContext(ctx)
	return auth.CheckSecret(s.secret, md)
}

func (s *exportServer) Health(ctx context.Context, _ *pb.HealthRequest) (*pb.HealthResponse, error) {
	if err := s.checkAuth(ctx); err != nil {
		return nil, err
	}
	return &pb.HealthResponse{Status: "ok"}, nil
}

func (s *exportServer) Export(req *pb.ExportRequest, stream pb.ExportService_ExportServer) error {
	if err := s.checkAuth(stream.Context()); err != nil {
		return err
	}

	metadata := exporter.ResponseMetadata(req)
	log.Printf(
		"export started project_id=%q format=%s view_id=%q user_id=%q filename=%q content_type=%q",
		req.GetProjectId(),
		req.GetFormat().String(),
		req.GetViewId(),
		req.GetUserId(),
		metadata.Filename,
		metadata.ContentType,
	)

	pr, pw := io.Pipe()
	errCh := make(chan error, 1)

	go func() {
		err := s.exporter.Export(stream.Context(), req, pw)
		if err != nil {
			_ = pw.CloseWithError(err)
		} else {
			_ = pw.Close()
		}
		errCh <- err
	}()

	buffer := make([]byte, s.chunkBytes)
	var sequence uint32
	var totalBytes int64
	for {
		n, err := pr.Read(buffer)
		if n > 0 {
			totalBytes += int64(n)
			chunk := &pb.FileChunk{
				Data:        append([]byte(nil), buffer[:n]...),
				Sequence:    sequence,
				Filename:    metadata.Filename,
				ContentType: metadata.ContentType,
			}
			if err := stream.Send(chunk); err != nil {
				log.Printf(
					"export failed project_id=%q format=%s filename=%q chunks_sent=%d bytes_sent=%d err=%v",
					req.GetProjectId(),
					req.GetFormat().String(),
					metadata.Filename,
					sequence,
					totalBytes,
					err,
				)
				return status.Errorf(codes.Canceled, "failed to send export chunk: %v", err)
			}
			sequence++
		}
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			log.Printf(
				"export failed project_id=%q format=%s filename=%q chunks_sent=%d bytes_sent=%d err=%v",
				req.GetProjectId(),
				req.GetFormat().String(),
				metadata.Filename,
				sequence,
				totalBytes,
				err,
			)
			return exporter.ToGRPCStatus(err)
		}
	}

	if err := <-errCh; err != nil {
		if errors.Is(err, context.Canceled) {
			log.Printf(
				"export canceled project_id=%q format=%s filename=%q chunks_sent=%d bytes_sent=%d",
				req.GetProjectId(),
				req.GetFormat().String(),
				metadata.Filename,
				sequence,
				totalBytes,
			)
			return status.Error(codes.Canceled, "export canceled")
		}
		log.Printf(
			"export failed project_id=%q format=%s filename=%q chunks_sent=%d bytes_sent=%d err=%v",
			req.GetProjectId(),
			req.GetFormat().String(),
			metadata.Filename,
			sequence,
			totalBytes,
			err,
		)
		return exporter.ToGRPCStatus(err)
	}

	log.Printf(
		"export completed project_id=%q format=%s filename=%q chunks=%d bytes=%d",
		req.GetProjectId(),
		req.GetFormat().String(),
		metadata.Filename,
		sequence,
		totalBytes,
	)
	return nil
}

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags)

	addr := getenv("EXPORT_GRPC_ADDR", ":9090")
	chunkBytes := intFromEnv("EXPORT_CHUNK_BYTES", 64*1024)
	service, err := exporter.New(exporter.Config{
		CouchDBURL:      getenv("COUCHDB_INTERNAL_URL", "http://localhost:5984"),
		CouchDBUsername: getenv("COUCHDB_USER", "admin"),
		CouchDBPassword: getenv("COUCHDB_PASSWORD", "password"),
		SharedSecret:    os.Getenv("EXPORT_SERVICE_SHARED_SECRET"),
	})
	if err != nil {
		log.Fatalf("failed to initialise exporter: %v", err)
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}

	server := grpc.NewServer()
	pb.RegisterExportServiceServer(server, &exportServer{
		exporter:   service,
		secret:     os.Getenv("EXPORT_SERVICE_SHARED_SECRET"),
		chunkBytes: chunkBytes,
	})
	log.Printf("FAIMS export service listening on %s", addr)
	if err := server.Serve(listener); err != nil {
		log.Fatalf("export service stopped: %v", err)
	}
}

func getenv(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}

func intFromEnv(name string, fallback int) int {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
