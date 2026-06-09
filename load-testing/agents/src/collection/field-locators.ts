import {fieldDomId} from '@faims3/load-testing-shared';
import type {Locator, Page} from 'playwright';

/** Container wrapping a single form field (`#field-{fieldId}`). */
export function fieldContainer(page: Page, fieldId: string): Locator {
  return page.locator(`#${cssEscape(fieldDomId(fieldId))}`);
}

/** Locate the primary text input or textarea within a field container. */
export function textInputInField(container: Locator, multiline?: boolean): Locator {
  if (multiline) {
    return container.locator('textarea').first();
  }
  return container
    .locator('input:not([type=hidden]):not([type=checkbox]):not([type=file])')
    .first();
}

/** Locate dropdown/combobox control within a field container. */
export function selectControlInField(container: Locator): Locator {
  return container
    .getByRole('combobox')
    .or(container.locator('[role="button"][aria-haspopup="listbox"]'))
    .first();
}

/** Locate the first checkbox input within a field container. */
export function checkboxInField(container: Locator): Locator {
  return container.locator('input[type="checkbox"]').first();
}

/** Escape special characters for safe use in CSS selectors. */
function cssEscape(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
