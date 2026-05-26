# Percentage Slider

_How to add and configure a Percentage Slider field in the {{Notebook}}
Editor._

---

## What This Field Does

A Percentage Slider field lets people choose an integer percentage by moving
a handle along a track, or by clicking the track to jump to a value. It is
suited to canopy cover, completion estimates, and other 0–100 style measures
where a visual control is clearer than typing numbers. Optional **minimum**,
**maximum**, and **step** keep values within the range you define and snap
to the increments you choose.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the
**NUMBERS** tab, and click the **Percentage Slider** card. Then click
the **ADD FIELD** button in the lower right.

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](../shared-settings/field-identity.md) and
[Field Toolbar](../shared-settings/field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

### Percentage Slider-Specific Settings

Below the identity fields, the Percentage Slider provides:

| Setting       | What It Does                                                                 |
| ------------- | ---------------------------------------------------------------------------- |
| **Minimum (%)** | Smallest value on the slider (0–100). Defaults to **0** if left unset.     |
| **Maximum (%)** | Largest value on the slider (0–100). Defaults to **100** if left unset.   |
| **Step**        | Increment between valid stops (e.g. **1** for every percent, **10** for tens). Defaults to **1** if left unset. Must fit within the min–max range. |

The app enforces that the minimum is not greater than the maximum, and that
stored values lie on the step grid (for example, with min 0, max 100, and step
10, only 0, 10, …, 100 are valid).

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](../shared-settings/field-options.md).

## Tips

- **Use step to match how precise the estimate should be.** Coarse steps
  (5 or 10) speed up entry for rough cover classes; step **1** when you need
  single-percent resolution.
- **Reset clears the value** until the person moves the slider again — useful
  for “not assessed” when the field is optional.
- **Required fields** must have a chosen value before the record can be
  completed; leave the field optional if “not measured” is valid.
