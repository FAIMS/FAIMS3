package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"os"

	"github.com/faims/faims3/export-service/internal/exporter"
	"github.com/faims/faims3/export-service/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type exportServer struct {
	pb.UnimplementedExportServiceServer
	exporter *exporter.Exporter
}

func (s *exportServer) Export(req *pb.ExportRequest, stream pb.ExportService_ExportServer) error {
	metadata := exporter.ResponseMetadata(req)
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

	buffer := make([]byte, 32*1024)
	var sequence uint32
	for {
		n, err := pr.Read(buffer)
		if n > 0 {
			chunk := &pb.FileChunk{
				Data:        append([]byte(nil), buffer[:n]...),
				Sequence:    sequence,
				Filename:    metadata.Filename,
				ContentType: metadata.ContentType,
			}
			if err := stream.Send(chunk); err != nil {
				return status.Errorf(codes.Canceled, "failed to send export chunk: %v", err)
			}
			sequence++
		}
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return status.Errorf(codes.Internal, "export stream failed: %v", err)
		}
	}

	if err := <-errCh; err != nil {
		if errors.Is(err, context.Canceled) {
			return status.Error(codes.Canceled, "export canceled")
		}
		return status.Errorf(codes.Internal, "export failed: %v", err)
	}
	return nil
}

func main() {
	addr := getenv("EXPORT_GRPC_ADDR", ":9090")
	service, err := exporter.New(exporter.Config{
		CouchDBURL:      getenv("COUCHDB_INTERNAL_URL", "http://localhost:5984"),
		CouchDBUsername: getenv("COUCHDB_USER", "admin"),
		CouchDBPassword: getenv("COUCHDB_PASSWORD", "password"),
	})
	if err != nil {
		log.Fatalf("failed to initialise exporter: %v", err)
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}

	server := grpc.NewServer()
	pb.RegisterExportServiceServer(server, &exportServer{exporter: service})
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
