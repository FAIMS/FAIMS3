/**
 * @file Config form for a Counted plan: how many records of the plan's form
 * are required, and whether extra records may be added.
 */

import {useEffect, useState} from 'react';
import {countedPlanTemplateConfigSchema} from '@faims3/data-model';
import {config} from '@/constants';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {formLabel, type PlanConfigFormProps} from './types';

export const CountedPlanConfigForm = ({
  template,
  uiSpec,
  onChange,
}: PlanConfigFormProps) => {
  const [numberRequired, setNumberRequired] = useState('');
  const [allowExtraRecords, setAllowExtraRecords] = useState(false);
  const [touched, setTouched] = useState(false);

  const targetForm = formLabel(uiSpec, template.formType as string);

  const result = countedPlanTemplateConfigSchema.safeParse({
    numberRequired: numberRequired === '' ? undefined : Number(numberRequired),
    allowExtraRecords,
  });

  useEffect(() => {
    onChange(result.success ? result.data : undefined);
  }, [numberRequired, allowExtraRecords, onChange]);

  const showError = touched && !result.success;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-number-required">
          Number of {targetForm} records required
        </Label>
        <Input
          id="plan-number-required"
          type="number"
          min={1}
          step={1}
          value={numberRequired}
          onChange={event => setNumberRequired(event.target.value)}
          onBlur={() => setTouched(true)}
          data-testid="plan-config-number-required"
        />
        {showError && (
          <p className="text-sm text-destructive">
            Enter a whole number greater than zero.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="plan-allow-extra"
          checked={allowExtraRecords}
          onCheckedChange={value => setAllowExtraRecords(value === true)}
          data-testid="plan-config-allow-extra"
        />
        <Label
          htmlFor="plan-allow-extra"
          className="font-normal cursor-pointer"
        >
          Allow extra records beyond the number required
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        The {config.notebookName} will track progress towards this count.
      </p>
    </div>
  );
};
