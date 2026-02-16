# Take Photo

*How to add and configure a Take Photo field in the Notebook Editor.*

---

## What This Field Does

A Take Photo field integrates the device camera for direct photo capture,
with an option to upload images (e.g., from the device's gallery). Photos are automatically
compressed to JPEG at 60% quality and scaled to a maximum width of
1920 px, balancing image quality with storage and sync performance.
Multiple photos can be attached to a single field. Use it for artefact
photography, site overview shots, condition recording, or any visual
documentation.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the
**MEDIA** tab, and click the **Take Photo** card. Then click the
**ADD FIELD** button in the lower right.

```{screenshot} field-types-design/take-photo-01-add-field.png
:alt: Adding a Take Photo — the MEDIA tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/take-photo-02-configured.png
:alt: Take Photo configuration in the {{Notebook}} Editor
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

- **Preferred over Attach File for camera-first workflows.** Take Photo
  opens the device camera directly for immediate capture, making it
  faster when photos are the primary media type. Upload of photos
  from the device's gallery or captured using an external camera
  remains possible.
- **EXIF data including GPS coordinates is preserved** on native
  mobile platforms — useful for spatial analysis but be aware of
  privacy implications if data will be shared publicly. GPS is not
  available on the web platform.
- **Consider how many photos per record are practical.** Performance
  degrades beyond ~20 photos per field due to storage and
  sync constraints. For large photo sets, use multiple Take Photo
  fields or a separate child form for photography.
