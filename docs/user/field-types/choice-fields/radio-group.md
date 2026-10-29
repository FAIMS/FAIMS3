# Select single

_How to add and configure a Select single field in the {{Notebook}}
Editor._

---

## What This Field Does

Allows the user to select a single option from a list. The options
are displayed either as a set of radio buttons or as a drop-down
menu. You can also configure an 'other' option which allows the user
to enter free text.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the **CHOICE**
tab, and click the **Select single** card. Then click the
**ADD FIELD** button in the lower right.

> **Note:** The CHOICE tab may not be visible in the tab bar initially —
> click the **›** arrow button on the right side of the tab bar to scroll
> until it appears.

```{screenshot} field-types-design/radio-group-01-add-field.png
:alt: Adding a Select single — the CHOICE tab in the ADD A FIELD dialog
:align: right
:width: 100%
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Export name, and the field toolbar — see
[Field Identity](../shared-settings/field-identity.md) and
[Field Toolbar](../shared-settings/field-toolbar.md).

Give the field a meaningful Label (the title collectors see), review
the auto-populated Export name (the CSV/GIS column header), and add any
desired Helper Text.

```{screenshot} field-types-design/radio-group-02-configured.png
:alt: Select single configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Select single-Specific Settings

The Select single field provides an **options list** identical in
structure to the Select Field. Below the Markdown syntax info banner,
you will find the **Add Option** input and a table listing all current
options.

| Setting                | What It Does                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Options list**       | The choices displayed as radio buttons. Each option appears as a row in the table.             |
| **Add "Other" Option** | Adds a special "Other" choice that prompts the collector to type a custom value when selected. |
| **Display mode**       | Select _Expanded Checklist_ or _Dropdown list_.                                                |

**Managing options:**

- **To add an option:** Type the option text in the **Add Option** input
  field and click **Add** (or press Enter).
- **To edit an option:** Click the **pencil** icon in the option's Actions
  column.
- **To reorder options:** Drag the **six-dot handle** on the left of the
  option, or use the **up/down arrow** buttons in the Actions column.
- **To delete an option:** Click the **trash** icon in the option's Actions
  column.
- **Add "Other" Option** Click to allow the user to select 'Other' from the
  list and enter free text into this field.

**Note**: You can use Markdown syntax in
option text (e.g., \*\*bold\*\* or \*italic\*) to add emphasis
or formatting to individual options.

```{screenshot} field-types-design/radio-group-03-options.png
:alt: Select single options list
:align: right
:width: 100%
```

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, and Copy value to new records — see
[Field Options](../shared-settings/field-options.md).

## Tips

- **Expanded Checklist is best for short lists of ca. 2–8 options** where seeing
  every choice at once speeds selection.
- **On small screens, err towards dropdown lists.**
  Radio buttons take more vertical space than a dropdown;
  on mobile devices with small screens a long radio list
  requires scrolling, offsetting their speed advantage.
- **Option text supports Markdown formatting** — use
  \*\*bold\*\* or \*italic\* to add emphasis to individual
  options.
