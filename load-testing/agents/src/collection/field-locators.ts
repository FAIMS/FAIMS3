import {fieldDomId} from '@faims3/load-testing-shared';
import type {Locator, Page} from 'playwright';

/** Container wrapping a single form field (`#field-{fieldId}`). */
export function fieldContainer(page: Page, fieldId: string): Locator {
  return page.locator(`#${cssEscape(fieldDomId(fieldId))}`);
}

export function textInputInField(container: Locator, multiline?: boolean): Locator {
  if (multiline) {
    return container.locator('textarea').first();
  }
  return container
    .locator('input:not([type=hidden]):not([type=checkbox]):not([type=file])')
    .first();
}

export function selectControlInField(container: Locator): Locator {
  return container
    .getByRole('combobox')
    .or(container.locator('[role="button"][aria-haspopup="listbox"]'))
    .first();
}

export function checkboxInField(container: Locator): Locator {
  return container.locator('input[type="checkbox"]').first();
}

function cssEscape(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
