# Parent Field Value

The **Parent Field Value** field displays a value from a record's parent
(read-only) while a collector is working in a child record. It provides
context from the parent — such as which site a building belongs to —
without requiring navigation back to the parent record. It does not
capture or store any data of its own.

The value is resolved live from the parent record each time the child is
viewed or edited, so later changes to the parent are always reflected.

## Adding the Field

In the {{Notebook}} Editor, open the form that will act as the child
record, select **Add a Field**, and navigate to the **DISPLAY** tab.
Select **Parent Field Value**.

```{screenshot} field-types-design/parent-field-value-01-add-field.png
:alt: Adding a Parent Field Value field in the {{Notebook}} Editor
:align: right
:width: 100%
```

Give the field a meaningful Label, review the auto-populated Field ID,
and add any desired Helper Text.

## Configuration

```{screenshot} field-types-design/parent-field-value-02-configured.png
:alt: Parent Field Value configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

The field's key setting is **Parent field to display**, which selects
the field in the parent form whose value is shown.

| Setting                     | What It Does                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Parent field to display** | A list of fields drawn from every form that can act as a parent of this form, grouped by form name. Choose the field whose value to show. |

A form can act as a parent of this form when it contains a
[Related Records](../relationship-fields/related-records.md) field with
a **Child** relationship targeting this form. If no such form exists
yet, the editor shows a notice instead of the list — add the
relationship field to the parent form first.

Because this field is display-only, the shared Required, Conditions,
Annotation, and Uncertainty options do not apply and are not shown.

## Behaviour During Data Collection

- When a collector creates a child record from a parent, the parent's
  value is shown immediately, and it remains visible when the record is
  later edited or viewed.
- If the parent record's value changes, the child shows the updated
  value the next time it is opened — the value is never copied into the
  child, only displayed from the parent.
- If the record has no parent (for example, it was created directly
  from the record list), or the parent's field is empty, a dash is
  shown instead of a value.
- A record can have parents of more than one form. The value is taken from
  the first parent whose form contains the configured field; other parents
  are ignored.

## Tips

- **Use it for orientation, not data entry.** Showing the parent's
  identifying field (such as a site name or grid square) at the top of
  the child form helps collectors confirm they are working in the right
  place.
- **To carry a value into the child's own data**, this field is not the
  right tool — it stores nothing. Values that must be recorded on the
  child should be entered in the child's own fields.
