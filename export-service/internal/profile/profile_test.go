package profile

import (
	"strings"
	"testing"
	"time"
)

func TestSnapshotLineIncludesMemoryStats(t *testing.T) {
	SetEnabled(true)
	t.Cleanup(func() { SetEnabled(false) })

	line := snapshotLine()
	for _, token := range []string{
		"[profile]",
		"goroutines=",
		"heap_alloc=",
		"heap_inuse=",
		"num_gc=",
	} {
		if !strings.Contains(line, token) {
			t.Fatalf("expected %q in snapshot line, got %q", token, line)
		}
	}
}

func TestBeginExportTracksActiveExport(t *testing.T) {
	resetForTest()
	SetEnabled(true)
	t.Cleanup(func() { SetEnabled(false) })

	done, recordChunk := BeginExport("project-1", "ZIP")
	if activeExports.Load() != 1 {
		t.Fatalf("expected 1 active export, got %d", activeExports.Load())
	}

	recordChunk(4096)
	time.Sleep(10 * time.Millisecond)

	exportMu.Lock()
	if len(exportStates) != 1 {
		t.Fatalf("expected 1 tracked export, got %d", len(exportStates))
	}
	state := exportStates[0]
	exportMu.Unlock()

	if state.bytes.Load() != 4096 || state.chunks.Load() != 1 {
		t.Fatalf("unexpected export counters: bytes=%d chunks=%d", state.bytes.Load(), state.chunks.Load())
	}

	done()
	if activeExports.Load() != 0 {
		t.Fatalf("expected active exports to return to 0, got %d", activeExports.Load())
	}
}

func TestBeginExportNoOpWhenDisabled(t *testing.T) {
	resetForTest()
	SetEnabled(false)

	_, _ = BeginExport("project-1", "ZIP")

	if activeExports.Load() != 0 {
		t.Fatalf("expected no active exports when disabled")
	}
}

func resetForTest() {
	activeExports.Store(0)
	totalExports.Store(0)
	exportMu.Lock()
	exportStates = nil
	exportMu.Unlock()
}
