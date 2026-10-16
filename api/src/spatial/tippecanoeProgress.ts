// SPDX-License-Identifier: Apache-2.0
/**
 * Parse tippecanoe `--json-progress` lines and classic `\r` status text.
 */
import type {MapAssetProcessingProgress} from '@faims3/data-model';

const PHASE_MAX = 80;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function clipPhase(phase: string): string {
  const trimmed = phase.trim();
  return trimmed.length <= PHASE_MAX ? trimmed : trimmed.slice(0, PHASE_MAX);
}

function fromJson(value: unknown): MapAssetProcessingProgress | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const phaseRaw =
    typeof record.phase === 'string'
      ? record.phase
      : typeof record.message === 'string'
        ? record.message
        : undefined;
  const raw =
    typeof record.progress === 'number'
      ? record.progress
      : typeof record.percent === 'number'
        ? record.percent
        : undefined;
  if (!phaseRaw?.trim() && raw === undefined) {
    return undefined;
  }
  let percent: number | undefined;
  if (raw !== undefined && Number.isFinite(raw)) {
    percent = clampPercent(raw >= 0 && raw <= 1 ? raw * 100 : raw);
  }
  return {
    phase: clipPhase(phaseRaw?.trim() || 'Tiling'),
    ...(percent === undefined ? {} : {percent}),
  };
}

/** One complete stderr line (JSON or classic tippecanoe text). */
export function parseTippecanoeProgressLine(
  line: string
): MapAssetProcessingProgress | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith('{')) {
    try {
      return fromJson(JSON.parse(trimmed));
    } catch {
      // Fall through to classic text.
    }
  }
  const colonPercent = trimmed.match(/^(.+?):\s*(\d+(?:\.\d+)?)%\s*$/);
  if (colonPercent) {
    return {
      phase: clipPhase(colonPercent[1]),
      percent: clampPercent(Number(colonPercent[2])),
    };
  }
  const zoomPercent = trimmed.match(/^(z\d+)\s+(\d+(?:\.\d+)?)%/i);
  if (zoomPercent) {
    return {
      phase: clipPhase(zoomPercent[1]),
      percent: clampPercent(Number(zoomPercent[2])),
    };
  }
  if (/^read\b/i.test(trimmed)) {
    return {phase: 'Reading'};
  }
  return undefined;
}

/** Split a stderr chunk on CR/LF and keep an incomplete trailing fragment. */
export function consumeTippecanoeProgress(buffer: string): {
  leftover: string;
  updates: MapAssetProcessingProgress[];
} {
  const parts = buffer.split(/\r|\n/);
  const leftover = parts.pop() ?? '';
  const updates: MapAssetProcessingProgress[] = [];
  for (const part of parts) {
    const parsed = parseTippecanoeProgressLine(part);
    if (parsed) {
      updates.push(parsed);
    }
  }
  return {leftover, updates};
}
