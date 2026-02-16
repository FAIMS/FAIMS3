# Select Field

*How to add and configure a Select Field in the Notebook Editor.*

---

## What This Field Does

A Select Field lets users pick one option from a dropdown list. It is the
standard choice for single-selection questions — for example, site types,
artefact categories, condition assessments, geological classifications, or
archaeological periods. The dropdown conserves screen space while keeping
the full list of options accessible.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the **CHOICE**
tab, and click the **Select Field** card. Then click the
**ADD FIELD** button in the lower right.

> **Note:** The CHOICE tab may not be visible in the tab bar initially —
> click the **›** arrow button on the right side of the tab bar to scroll
> until it appears.

```{screenshot} field-types-design/select-01-add-field.png
:alt: Adding a Select Field — the CHOICE tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/select-02-configured.png
:alt: Select Field configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Select-Specific Settings

The Select Field's key setting is the **options list** — the
choices available in the dropdown. Below the Markdown syntax info banner,
you will find the **Add Option** input, the **Add "Other" Option** button,
and a table listing all current options.

| Setting | What It Does |
| ------- | ------------ |
| **Options list** | The choices that appear in the dropdown. Each option is shown as a row in the table below. |
| **Add "Other" Option** | Adds a special "Other" choice that prompts the collector to type a custom value when selected. |

**Note**: As per the banner, you can use Markdown syntax in
option text (e.g., \*\*bold\*\* or \*italic\*) to add emphasis
or formatting to individual options.

```{screenshot} field-types-design/select-03-options.png
:alt: Select Field options list — Add Option input, options table with drag handles and action buttons
:align: right
:width: 100%
```

**Managing options:**

- **To add an option:** Type the option text in the **Add Option** input
  field and click **Add** (or press Enter).
- **To edit an option:** Click the **pencil** icon in the option's Actions
  column.
- **To reorder options:** Drag the **six-dot handle** on the left of the
  option, or use the **up/down arrow** buttons in the Actions column.
- **To delete an option:** Click the **trash** icon in the option's Actions
  column.

The display label and stored value are always the same — what your users
see is exactly what appears in exported data. There are no hidden codes.
To allow users to leave the field blank, include an empty option such as
"-- None --" at the top of your list.

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

## Tips

- **Choose the right selection field for your list size.** Select
  Field is ideal for lists of 8–20 options. For shorter lists
  (2–7 items), consider '[Select one option](radio-group.md)' for more rapid entry,
  at the cost of more screen real estate.
  For very long (>20 items) or intrinsically hierarchical lists,
  consider [Select Field (Hierarchical)](hierarchical-select.md).
- **Include a "-- None --" option** if collectors need to clear a
  selection — there is no built-in deselect button. Without a blank option,
  once a choice is made it cannot be undone.
- **Enable Annotation and Uncertainty** for fields where
  collectors might need to qualify their choice, such as noting
  "tentative identification" or "poor visibility conditions".
  Annotation, combined with Uncertainty, is especially valuable
  for classification fields where confidence varies.
