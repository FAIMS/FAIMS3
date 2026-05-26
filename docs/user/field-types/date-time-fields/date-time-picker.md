# Date time picker

_How to add and configure a Date time picker field in the {{Notebook}}
Editor._

---

## What This Field Does

A Date time picker captures a date and time. It accepts arbitrary date and
time entry and can optionally show a **"Now" button** for one-tap capture of
the current timestamp — covering both the everyday "record this moment" use
case and the historical / scheduled "enter a specific date" case in a single
field.

> **Note:** Date time picker is the recommended date-and-time field for new
> notebooks. The legacy
> [Date and Time with Now button](date-time-now.md) field type is now
> deprecated; enable **Show "Now" button** on this field to get the same
> one-tap capture behaviour.

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

- **Enable Show "Now" button** when collectors will most often be capturing
  the current moment (observation timestamps, record creation time). The
  field still accepts manual entry, so historical or scheduled times remain
  possible.
- **Add Helper Text documenting the assumed timezone** (e.g., "All times are
  recorded in AEST") so the assumption is captured alongside the data — this
  is especially important when team members travel between timezones or
  collaborate across regions.
- **Consider the travel scenario** — a team based in Sydney conducting
  fieldwork in Greece may have devices still showing Sydney time. Be explicit
  in the field's Helper Text about which clock the timestamp represents.
