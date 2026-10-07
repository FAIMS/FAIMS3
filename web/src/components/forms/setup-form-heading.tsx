// SPDX-License-Identifier: Apache-2.0
/**
 * @file Heading for a template's setup fields inside the create form, placed
 * through Form's dividers so they read as a section apart from the
 * notebook's own name, description and team. Mirrors PlanHeading.
 */

import {config} from '@/constants';

export const SetupFormHeading = () => (
  <div className="mt-2 border-t pt-4">
    <h3 className="text-sm font-medium">Setup details</h3>
    <p className="text-sm text-muted-foreground">
      Additional details this template asks for. They are stored with the{' '}
      {config.notebookName}, not as record data.
    </p>
  </div>
);
