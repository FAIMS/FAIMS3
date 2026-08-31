import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useId} from 'react';

/**
 * Labelled `datetime-local` field matching invite / token expiry styling.
 */
export function DateTimeLocalInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  testId?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Input
        id={inputId}
        type="datetime-local"
        value={value}
        min={min}
        max={max}
        onChange={event => onChange(event.target.value)}
        className="w-full"
        data-testid={testId}
      />
    </div>
  );
}
