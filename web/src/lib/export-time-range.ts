/** Shared inclusive datetime-local → exclusive export query bounds. */

export type ExportTimeRangeState = {
  enabled: boolean;
  from: string;
  to: string;
};

/**
 * Resolve field values from either top-level props or a nested `state`
 * object. Forms spread `useExportTimeRange()` onto the fields component;
 * `enabled` must still win if it is only nested under `state`.
 */
export function resolveTimeRangeFieldValues(props: {
  enabled?: boolean;
  from?: string;
  to?: string;
  state?: ExportTimeRangeState;
}): ExportTimeRangeState {
  return {
    enabled: props.enabled ?? props.state?.enabled ?? false,
    from: props.from ?? props.state?.from ?? '',
    to: props.to ?? props.state?.to ?? '',
  };
}

/** Parse a `datetime-local` value (`YYYY-MM-DDTHH:MM`) as a local instant. */
export function parseDateTimeLocalMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Inclusive From minute → exclusive `updatedAfter` (API is exclusive).
 * `YYYY-MM-DDTHH:MM` → `fromMs - 1`.
 */
export function inclusiveFromToExclusiveAfter(
  fromLocal: string
): number | undefined {
  const ms = parseDateTimeLocalMs(fromLocal);
  return ms === undefined ? undefined : ms - 1;
}

/**
 * Inclusive To minute → exclusive `updatedBefore`.
 * `YYYY-MM-DDTHH:MM` → `toMs + 60_000` so the whole selected minute is included.
 */
export function inclusiveToToExclusiveBefore(
  toLocal: string
): number | undefined {
  const ms = parseDateTimeLocalMs(toLocal);
  return ms === undefined ? undefined : ms + 60_000;
}

/** Validate From ≤ To on the raw picker instants (same minute is allowed). */
export function exportTimeRangeError(
  state: ExportTimeRangeState
): string | undefined {
  if (!state.enabled) return undefined;
  const fromMs = parseDateTimeLocalMs(state.from);
  const toMs = parseDateTimeLocalMs(state.to);
  if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
    return 'From must be earlier than To.';
  }
  return undefined;
}

/**
 * Append `updatedAfter` / `updatedBefore` when the checkbox is on and that
 * side has a value. Unchecked, or checked with both empty, adds nothing.
 */
export function appendExportTimeRangeParams(
  params: URLSearchParams,
  state: ExportTimeRangeState
): void {
  if (!state.enabled) return;
  if (state.from) {
    const after = inclusiveFromToExclusiveAfter(state.from);
    if (after !== undefined) params.set('updatedAfter', String(after));
  }
  if (state.to) {
    const before = inclusiveToToExclusiveBefore(state.to);
    if (before !== undefined) params.set('updatedBefore', String(before));
  }
}
