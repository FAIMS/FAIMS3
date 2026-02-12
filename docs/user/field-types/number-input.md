# Number Input

*How to add and configure a Number Input field in the Notebook Editor.*

---

## What This Field Does

A Number Input field accepts numeric data — measurements, counts,
calculations, or scientific readings. It supports both integers and
decimals, distinguishes empty (null) from zero, and handles scientific
notation (e.g., 1.23e-7).

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the **NUMBERS**
tab, and click the **Number Input** card. Then click the **ADD FIELD**
button in the lower right.

```{screenshot} field-types-design/number-input-01-add-field.png
:alt: Adding a Number Input — the NUMBERS tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/number-input-02-configured.png
:alt: Number Input configuration in the {{Notebook}} Editor — identity fields and Number Type setting
:align: right
```

### Number Input-Specific Settings

Below the identity fields, a **Number Type** setting controls the kind of
numeric data the field accepts:

| Number Type | What It Does |
| ----------- | ------------ |
| **Integer** | Accepts whole numbers only. Shows stepper controls (up/down arrows) for quick adjustment. |
| **Decimal** | Accepts fractional values (e.g., 3.14, 0.001). This is the default. |

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

## Tips

- **Integer vs Decimal depends on your data.** Use Integer for counts
  (artefact quantities, stratum numbers) and Decimal for measurements
  (depths, weights, coordinates).
- **An empty field stores null, not zero.** This preserves the distinction
  between "not measured" and "measured as zero" — important for
  data where missing values have different analytical implications.
- **On iOS devices, the number keyboard lacks a minus key.** If collectors
  need to enter negative values (e.g., below-datum elevations), consider
  using a FAIMS Text Field with format guidance instead, or instruct
  collectors to copy-paste the minus character.
- **Enable Annotation and Uncertainty** for measurement fields
  where collectors might need to note instrument type, recording
  conditions, measurement difficulties, or confidence.
