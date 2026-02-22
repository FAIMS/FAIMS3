# Date time picker

*How to add and configure a Date time picker field in the {{Notebook}}
Editor.*

---

## What This Field Does

A Date Time Picker captures a date and time as a local datetime string
without timezone information. It is functionally similar to Date/Time
with Now but lacks timezone preservation, making timestamps ambiguous
when teams span multiple timezones.

> **Warning:** This field is **discouraged for new {{notebooks}}.** Because
> it stores timestamps without timezone information, the same time value
> (e.g., "14:30") represents different times in different
> locations. Use [Date/Time with Now](date-time-now.md) instead for
> timezone-safe dates. Date/Time with Now accepts arbitrary dates in
> addition to "now" timestamps.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the
**DATE & TIME** tab, and click the **Date time picker** card. Then
click the **ADD FIELD** button in the lower right.

```{screenshot} field-types-design/date-time-picker-01-add-field.png
:alt: Adding a Date Time Picker — the DATE & TIME tab in the ADD A FIELD dialog
:align: right
:width: 100%
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](../shared-settings/field-identity.md) and
[Field Toolbar](../shared-settings/field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

```{screenshot} field-types-design/date-time-picker-02-configured.png
:alt: Date Time Picker configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](../shared-settings/field-options.md).

## Tips

- **Use Date/Time with Now instead** unless your project operates
  entirely within a single timezone with no device travel. Date/Time
  with Now stores UTC timestamps that survive timezone changes and
  enable accurate cross-site synchronisation.
- **If you must use this field**, add Helper Text documenting the
  assumed timezone (e.g., "All times are AEST") so the assumption is
  recorded alongside the data and can be applied during
  post-processing.
- **Consider the travel scenario** — a team based in Sydney conducting
  fieldwork in Greece may have devices still showing Sydney time.
  This field would record an ambiguous "14:30" with no way to know
  which timezone was intended.
