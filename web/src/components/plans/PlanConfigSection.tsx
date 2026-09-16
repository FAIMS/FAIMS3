/**
 * @file Plan configuration block for component-based plan types: resolves a
 * plan template's type to its config form, or explains when none exists.
 */

import type {PlanTemplate} from '@faims3/data-model';
import {config} from '@/constants';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {
  getPlanConfigType,
  type PlanConfig,
  type PlanConfigUiSpec,
} from './registry';

export const PlanConfigSection = ({
  template,
  uiSpec,
  onChange,
}: {
  template: PlanTemplate;
  uiSpec: PlanConfigUiSpec;
  onChange: (planConfig: PlanConfig | undefined) => void;
}) => {
  const planType = template.planType;
  const definition = getPlanConfigType(planType);

  if (!definition || !('ConfigForm' in definition)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unsupported plan type</AlertTitle>
        <AlertDescription>
          The {template.label} plan is of type {planType}, which cannot be
          configured here. Create the {config.notebookName} through the API,
          which takes the plan's configuration.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      data-testid="plan-config-section"
    >
      <h3 className="text-sm font-medium">{template.label} plan</h3>
      {template.description && (
        <p className="text-sm text-muted-foreground">{template.description}</p>
      )}
      <definition.ConfigForm
        template={template}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    </div>
  );
};
