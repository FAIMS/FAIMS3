# Text Fields

The **TEXT** tab contains field types for capturing text-based data, from
short codes and labels to multi-line descriptions and email addresses.

```{toctree}
---
caption: Text Fields
hidden: true
---

faims-text-field.md
email-field.md
multiline-text-field.md
templated-string.md
qr-barcode-scanner.md
address.md

```

- **[FAIMS Text Field](faims-text-field.md)** — Deprecated as a separate
  field type; existing fields remain supported. Use the unified **Text field**
  chooser entry for new single-line text inputs.
- **[Email](email-field.md)** — A single-line text input with built-in email
  format validation that opens the email keyboard on mobile devices.
- **[Multi-line Text Field](multiline-text-field.md)** — Deprecated as a
  separate field type; existing fields remain supported. Use the unified
  **Text field** chooser entry with the **multi-line** option enabled for new
  extended-text inputs.
- **[Templated String](templated-string.md)** — Auto-generates text from
  other fields using templates; required for human-readable record
  identifiers.
- **[QR / Barcode Scanner](qr-barcode-scanner.md)** — Mobile-only barcode
  and QR code scanning, supporting multiple barcode formats.
- **[Address](address.md)** — Structured address capture storing data in a
  geocoding-compatible format. Beta feature.
