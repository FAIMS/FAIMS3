import {DateTimeLocalInput} from '@/components/date-time-local-input';
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
import {
  appendExportTimeRangeParams,
  exportTimeRangeError,
  resolveTimeRangeFieldValues,
  type ExportTimeRangeState,
} from '@/lib/export-time-range';
import {useId, useState} from 'react';

/** Inclusive From/To picker state plus `appendTo` for export query strings. */
export function useExportTimeRange() {
  const [enabled, setEnabled] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const state: ExportTimeRangeState = {enabled, from, to};
  const error = exportTimeRangeError(state);

  const appendTo = (params: URLSearchParams) =>
    appendExportTimeRangeParams(params, state);

  return {
    enabled,
    from,
    to,
    state,
    error,
    setEnabled,
    setFrom,
    setTo,
    appendTo,
  };
}

/** Checkbox + From/To fields shared by full, tabular, and photo export forms. */
export function ExportTimeRangeFields({
  enabled: enabledProp,
  from: fromProp,
  to: toProp,
  state,
  error,
  setEnabled,
  setFrom,
  setTo,
}: {
  enabled?: boolean;
  from?: string;
  to?: string;
  state?: ExportTimeRangeState;
  error?: string;
  setEnabled: (enabled: boolean) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
}) {
  const {enabled, from, to} = resolveTimeRangeFieldValues({
    enabled: enabledProp,
    from: fromProp,
    to: toProp,
    state,
  });
  const enabledId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={enabledId}
          data-testid="web-export-time-range-enabled"
          checked={enabled}
          onCheckedChange={checked => setEnabled(checked === true)}
        />
        <Label
          htmlFor={enabledId}
          className="text-sm font-medium cursor-pointer"
        >
          Only include records within a time range
        </Label>
      </div>
      {enabled && (
        <div className="flex flex-col gap-3 pl-7">
          <DateTimeLocalInput
            label="From"
            value={from}
            onChange={setFrom}
            testId="web-export-time-from"
          />
          <DateTimeLocalInput
            label="To"
            value={to}
            onChange={setTo}
            testId="web-export-time-to"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
