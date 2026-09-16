/**
 * @file Heading for a plan's fields inside the create form, placed through
 * Form's dividers so field-based plan types read as a section.
 */

import type {PlanTemplate} from '@faims3/data-model';

export const PlanHeading = ({template}: {template: PlanTemplate}) => (
  <div className="mt-2 border-t pt-4">
    <h3 className="text-sm font-medium">{template.label} plan</h3>
    {template.description && (
      <p className="text-sm text-muted-foreground">{template.description}</p>
    )}
  </div>
);
