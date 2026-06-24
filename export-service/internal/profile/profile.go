package profile

import (
	"fmt"
	"log"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var (
	enabled       atomic.Bool
	activeExports atomic.Int64
	totalExports  atomic.Int64
)

type exportState struct {
	projectID string
	format    string
	bytes     atomic.Int64
	chunks    atomic.Int64
	started   time.Time
}

var (
	exportMu     sync.Mutex
	exportStates []*exportState
)

// SetEnabled turns periodic profiling output on or off.
func SetEnabled(on bool) {
	enabled.Store(on)
}

// Enabled reports whether periodic profiling output is active.
func Enabled() bool {
	return enabled.Load()
}

// Start begins printing runtime stats once per second until stop is closed.
func Start(stop <-chan struct{}) {
	if !enabled.Load() {
		return
	}

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		log.Printf("[profile] monitoring enabled (interval=1s)")
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				log.Print(snapshotLine())
			}
		}
	}()
}

// BeginExport marks an export as active and returns cleanup and chunk-recording callbacks.
func BeginExport(projectID, format string) (done func(), recordChunk func(int64)) {
	noop := func() {}
	recordNoop := func(int64) {}

	if !enabled.Load() {
		return noop, recordNoop
	}

	state := &exportState{
		projectID: projectID,
		format:    format,
		started:   time.Now(),
	}

	exportMu.Lock()
	exportStates = append(exportStates, state)
	exportMu.Unlock()

	activeExports.Add(1)
	totalExports.Add(1)

	done = func() {
		activeExports.Add(-1)
		exportMu.Lock()
		for i, candidate := range exportStates {
			if candidate == state {
				exportStates = append(exportStates[:i], exportStates[i+1:]...)
				break
			}
		}
		exportMu.Unlock()
	}

	recordChunk = func(bytes int64) {
		if bytes <= 0 {
			return
		}
		state.bytes.Add(bytes)
		state.chunks.Add(1)
	}

	return done, recordChunk
}

func snapshotLine() string {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	parts := []string{
		fmt.Sprintf("goroutines=%d", runtime.NumGoroutine()),
		fmt.Sprintf("active_exports=%d", activeExports.Load()),
		fmt.Sprintf("total_exports=%d", totalExports.Load()),
		fmt.Sprintf("heap_alloc=%s", bytes(mem.HeapAlloc)),
		fmt.Sprintf("heap_inuse=%s", bytes(mem.HeapInuse)),
		fmt.Sprintf("heap_sys=%s", bytes(mem.HeapSys)),
		fmt.Sprintf("stack_inuse=%s", bytes(mem.StackInuse)),
		fmt.Sprintf("sys=%s", bytes(mem.Sys)),
		fmt.Sprintf("total_alloc=%s", bytes(mem.TotalAlloc)),
		fmt.Sprintf("num_gc=%d", mem.NumGC),
		fmt.Sprintf("gc_pause_total=%s", duration(time.Duration(mem.PauseTotalNs))),
	}

	exportMu.Lock()
	states := append([]*exportState(nil), exportStates...)
	exportMu.Unlock()

	for _, state := range states {
		parts = append(parts, fmt.Sprintf(
			"export{project=%q format=%s bytes=%s chunks=%d elapsed=%s}",
			state.projectID,
			state.format,
			bytes(uint64(state.bytes.Load())),
			state.chunks.Load(),
			duration(time.Since(state.started)),
		))
	}

	return "[profile] " + strings.Join(parts, " ")
}

func bytes(value uint64) string {
	const unit = 1024
	if value < unit {
		return fmt.Sprintf("%dB", value)
	}

	div := uint64(unit)
	exp := 0
	for n := value / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%ciB", float64(value)/float64(div), "KMGTPE"[exp])
}

func duration(value time.Duration) string {
	if value < time.Millisecond {
		return value.String()
	}
	if value < time.Second {
		return fmt.Sprintf("%.0fms", float64(value)/float64(time.Millisecond))
	}
	return fmt.Sprintf("%.1fs", float64(value)/float64(time.Second))
}
