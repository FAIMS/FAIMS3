# Address

*How to add and configure an Address field in the Notebook Editor.*

---

## What This Field Does

An Address field provides structured address capture, storing data in
a geocoding-compatible format with separate components for street,
suburb, state, and postcode. Use it for site addresses, museum
locations, or any context where a structured postal address is needed
for correspondence or spatial analysis.

> **Note:** This field is a **beta feature**. It was developed for a
> specific client requirement and may have rough edges. Test
> thoroughly before relying on it for critical workflows.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the **TEXT**
tab, and click the **Address** card. Then click the **ADD FIELD**
button in the lower right.

```{screenshot} field-types-design/address-01-add-field.png
:alt: Adding an Address field — the TEXT tab in the ADD A FIELD dialog
:align: right
:width: 100%
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](field-identity.md) and
[Field Toolbar](field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

```{screenshot} field-types-design/address-02-configured.png
:alt: Address field configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

## Tips

- **Data is stored as structured JSON** with separate components
  (house number, road, suburb, state, postcode), not as a single
  text string. This format is better for downstream analysis but requires
  JSON post-processing when exporting to CSV.
- **Only five of the nine address components are exposed in the
  UI** (House Number, Stree Name, Suburb, State, Postcode). Four other fields (Country, Country Code, Town, and Municipality) are stored
  in the data structure but not editable through the form interface.
- **Auto-complete availability varies by platform and region** — do
  not assume address suggestions will always appear. Manual entry
  is always available as a fallback.
- **Allow a brief pause between fields** when entering address
  data — rapid tabbing between components may trigger a race
  condition that can cause data loss.
