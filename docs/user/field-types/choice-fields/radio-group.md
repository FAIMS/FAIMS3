# Select one option

*How to add and configure a Select one option field in the {{Notebook}}
Editor.*

---

## What This Field Does

A Select one option field displays all choices as radio buttons,
letting users pick exactly one. All options are visible
simultaneously without opening a dropdown, which can be faster
for short lists (~2–8 items). Use it when you want collectors to
see every option at a glance — for example, a soil texture class,
a condition rating, yes/no, or a Likert scale.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the **CHOICE**
tab, and click the **Select one option** card. Then click the
**ADD FIELD** button in the lower right.

> **Note:** The CHOICE tab may not be visible in the tab bar initially —
> click the **›** arrow button on the right side of the tab bar to scroll
> until it appears.

```{screenshot} field-types-design/radio-group-01-add-field.png
:alt: Adding a Select one option — the CHOICE tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/radio-group-02-configured.png
:alt: Select one option configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Select one option-Specific Settings

The Select one option field provides an **options list** identical in
structure to the Select Field. Below the Markdown syntax info banner,
you will find the **Add Option** input and a table listing all current
options.

| Setting | What It Does |
| ------- | ------------ |
| **Options list** | The choices displayed as radio buttons. Each option appears as a row in the table. |

**Managing options:**

- **To add an option:** Type the option text in the **Add Option** input
  field and click **Add** (or press Enter).
- **To edit an option:** Click the **pencil** icon in the option's Actions
  column.
- **To reorder options:** Drag the **six-dot handle** on the left of the
  option, or use the **up/down arrow** buttons in the Actions column.
- **To delete an option:** Click the **trash** icon in the option's Actions
  column.

```{screenshot} field-types-design/radio-group-03-options.png
:alt: Select one option options list
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

- **Best for short lists of ca. 2–8 options** where seeing
  every choice at once speeds selection. For longer lists,
  use [Select Field](select.md) (dropdown) to conserve
  screen space.
- **On small screens, err towards Select Field.**
  Radio buttons take more vertical space than a dropdown;
  on mobile devices with small screens a long radio list
  requires scrolling, offsetting their speed advantage.
- **Option text supports Markdown formatting** — use
  \*\*bold\*\* or \*italic\* to add emphasis to individual
  options.
