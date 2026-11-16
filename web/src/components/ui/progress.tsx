// SPDX-License-Identifier: Apache-2.0
import {cn} from '@/lib/utils';

/** Muted-track / primary-fill bar. `value` is 0–100. */
export function Progress({
  value,
  label,
  indeterminate,
  className,
}: {
  value: number;
  label?: string;
  indeterminate?: boolean;
  className?: string;
}) {
  const percent = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 animate-pulse bg-primary" />
      ) : (
        <div
          className="h-full bg-primary transition-[width]"
          style={{width: `${percent}%`}}
        />
      )}
    </div>
  );
}
