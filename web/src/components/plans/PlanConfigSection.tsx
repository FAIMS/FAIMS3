/**
 * @file Plan configuration block for the create-from-template form: resolves
 * the template's plan type to its config form, or explains when none exists.
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
  const planType = template.planType as string;
  const definition = getPlanConfigType(planType);

  if (!definition) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unsupported plan type</AlertTitle>
        <AlertDescription>
          This template defines a {planType} plan that cannot be configured
          here. Create the {config.notebookName} through the API, which takes
          the plan's configuration.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      data-testid="plan-config-section"
    >
      <h3 className="text-sm font-medium">{definition.label} plan</h3>
      <definition.ConfigForm
        template={template}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    </div>
  );
};
