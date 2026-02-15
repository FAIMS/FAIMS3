# Date/Time with Now

*How to add and configure a Date/Time with Now field in the {{Notebook}}
Editor.*

---

## What This Field Does

A Date/Time with Now field captures timezone-aware timestamps in ISO 8601
format with UTC timezone preservation. It includes a convenient "Now"
button for one-tap capture of the current date and time — but also
accepts manually entered dates, including historical ones. This is the
recommended default for all timestamp fields, especially in multi-site
projects where timezone safety matters.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the
**DATE & TIME** tab, and click the **Date and Time with Now button**
card. Then click the **ADD FIELD** button in the lower right.

```{screenshot} field-types-design/date-time-now-01-add-field.png
:alt: Adding a Date/Time with Now — the DATE & TIME tab in the ADD A FIELD dialog
:align: right
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](field-identity.md) and
[Field Toolbar](field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

```{screenshot} field-types-design/date-time-now-02-configured.png
:alt: Date/Time with Now configuration in the {{Notebook}} Editor
:align: right
```

### Date/Time with Now-Specific Settings

| Setting | What It Does |
| ------- | ------------ |
| **Time pre-populated** | When enabled, the field is automatically filled with the current date and time when a new record is created. Collectors can still override the value. |

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

## Tips

- **Date/Time with Now is the recommended default for all timestamps.** One tap
  captures the current date and time with timezone information,
  ensuring synchronisation safety across team members in different
  locations.
- **Prefer Date/Time with Now for all date-and-time capture, not
  just current timestamps.** Despite "Now" in the name, this field
  accepts arbitrary dates including historical ones.
- **The captured timestamp uses the device clock** — remind field
  teams to sync their device clocks before starting work each day.
