# Conditions

*How to use the conditions builder to show or hide fields based on
other fields' values.*

---

## Overview

Conditions let you create visibility rules so that a field only appears
when another field has a particular value. For example, you might show
a "Please specify" text field only when a collector selects "Other" in
a dropdown, or reveal a detailed damage assessment section only when a
checkbox is ticked. Conditions are configured per-field in the {{Notebook}}
Editor and evaluated dynamically during data collection.

```{screenshot} field-types-design/shared-05-conditions.png
:alt: An expanded field showing a configured condition banner
:align: right
```

## Adding a Condition

1. Expand the field you want to conditionally show or hide.
2. Scroll down to the shared options panel and click the
   **ADD CONDITION** button.
3. A condition row appears with three elements:
   - **Field** — a dropdown listing all other fields in the same
     form. Select the field whose value should control visibility.
   - **Operator** — a dropdown of comparison operators (see
     [Operators](#operators) below).
   - **Value** — the value to compare against. For choice fields,
     this is a dropdown of the available options; for other field
     types, a text input.
4. Click the **save** icon (floppy disk) to confirm the condition.
5. Click **SAVE CHANGES** at the bottom of the field to apply.

```{screenshot} field-types-design/shared-06-conditions-editor.png
:alt: The condition editor showing the Field, Operator, and Value dropdowns
:align: right
```

To remove a condition, click the **red minus** icon next to it.

## Operators

The condition builder offers operators organised into three groups.

### Comparison Operators

For comparing a field's value against a single value.

| Operator | What It Checks |
| -------- | -------------- |
| **Equal to** | Field value matches the specified value exactly. |
| **Not equal to** | Field value does not match the specified value. |
| **Greater than** | Field value is greater than the specified number. |
| **Greater than or equal** | Field value is greater than or equal to the specified number. |
| **Less than** | Field value is less than the specified number. |
| **Less than or equal** | Field value is less than or equal to the specified number. |
| **Matches regular expression** | Field value matches a regex pattern (advanced). |

### List Operators

For comparing against fields that accept multiple selections (e.g.,
Select Multiple).

| Operator | What It Checks |
| -------- | -------------- |
| **List contains this value** | The selected list includes the specified value. |
| **List does not contain this value** | The selected list excludes the specified value. |
| **List contains one of these values** | The selected list includes at least one of the specified values. |
| **List does not contain any of these values** | The selected list includes none of the specified values. |
| **List contains all of these values** | The selected list includes every one of the specified values. |

### Compound Operators

For combining multiple conditions on the same field.

| Operator | What It Checks |
| -------- | -------------- |
| **AND** | All nested conditions must be true for the field to appear. |
| **OR** | Any one nested condition must be true for the field to appear. |

## How Conditions Behave

- **Conditions are evaluated dynamically** — fields appear and
  disappear instantly as the controlling field's value changes.
- **Conditions can only reference fields in the same form.** You
  cannot reference fields in a different form or in a parent/child
  record.
- **Sections hide automatically** when all their fields are hidden
  by conditions, keeping the form tidy.
- **Hidden fields retain their data.** If a collector fills in a
  field and it is subsequently hidden by a condition change, the
  data is preserved (not deleted).
- **Validation on hidden fields** is filtered from the visible
  error display. However, be cautious about marking conditionally
  shown fields as Required — if the field is hidden but still
  required, it may cause confusion.

## Tips

- **Start with the "Other — please specify" pattern.** The most
  common use of conditions is revealing a free-text field when a
  collector chooses "Other" in a Select or Select one option field.
  This is a good first condition to try.
- **Keep conditions simple.** A single condition per field
  (e.g., show when Feature type = "Burial") is easy to understand
  and debug. Compound conditions (AND/OR) are powerful but harder
  to test — use them sparingly.
- **Test conditions in a deployed {{notebook}}**, not in the {{Notebook}}
  Editor preview. The Editor shows the condition configuration but
  does not simulate the dynamic show/hide behaviour.
- **Be careful with Required on conditional fields.** If a field
  is marked Required but hidden by a condition, collectors cannot
  see or fill it. Consider whether the field should truly be
  mandatory in all cases.
- **Conditions cannot reference complex fields** like Take Photo,
  Take GPS Point, or Map Field directly. If you need to branch
  based on whether a photo was taken, use a Checkbox as a gateway
  question (e.g., "Photo taken?") and condition on that instead.
