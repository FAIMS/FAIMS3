/**
 * @file Heading for a plan's fields inside the create form, placed through
 * Form's dividers so field-based plan types read as a section.
 */

import type {PlanTemplate} from '@faims3/data-model';

export const PlanHeading = ({
  template,
  note,
}: {
  template: PlanTemplate;
  /** Shown under the description where the plan has no fields to follow. */
  note?: string;
}) => (
  <div className="mt-2 border-t pt-4">
    <h3 className="text-sm font-medium">{template.label} plan</h3>
    {template.description && (
      <p className="text-sm text-muted-foreground">{template.description}</p>
    )}
    {note && <p className="text-sm text-muted-foreground">{note}</p>}
  </div>
);
