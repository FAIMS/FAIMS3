# {{FAIMS}} Field types

{{FAIMS}} offers a range of data formats and metadata within a {{Notebook}}, to suit different data collection needs. Each field type is described in brief below. Click on the links to discover more.

> **Note**
> For information on how to configure different fields types in the _Notebook Editor_, see [Field Types Reference Table](../authoring/field-type-reference-table.md) and [A Guide to Best Practice Field Selection](../authoring/field-selection-best-practices.md).

## Text Fields

**TEXT** field types are for capturing text-based data, from short codes and labels to multi-line descriptions and email addresses.

- **[FAIMS Text Field](../field-types/text-fields/faims-text-field.md)** — A single-line input for   brief, unconstrained text such as codes, identifiers, and short labels.
- **[Multi-line Text Field](../field-types/text-fields/multiline-text-field.md)** — Extended text entry for narrative content and detailed observations, with internal scrolling   for longer passages.
- **[Email](../field-types/text-fields/email-field.md)** — A single-line text input with built-in email format validation that opens the email keyboard on mobile devices.

## Choice Fields

**CHOICE** field types are for controlled vocabulary input, from simple checkboxes to hierarchical selection lists.

- **[Select Field](../field-types/choice-fields/select.md)** — Lets users pick one option from a dropdown
  list, suitable for site types, artefact categories, condition assessments,
  and similar single-selection questions.
- **[Checkbox](../field-types/choice-fields/checkbox.md)** — A toggle that stores a boolean value (checked
  or unchecked) for presence/absence indicators, consent acknowledgements, and
  data quality flags.
- **[Select Multiple](../field-types/choice-fields/multi-select.md)** — Lets users pick multiple options
  from a predefined list, with dropdown or expanded checklist display.
- **[Select Field (Hierarchical)](../field-types/choice-fields/hierarchical-select.md)** — Navigates a
  nested vocabulary tree to select a value. Beta feature.
- **[Select one option](../field-types/choice-fields/radio-group.md)** — Displays all options as a
  visible list for single selection; suited to short lists of 2–10 items.

## Number Fields

The **NUMBERS** tab contains field types for numeric and sequential data.

- **[Number Input](../field-types/number-fields/number-input.md)** — Accepts numeric data including
  measurements, counts, calculations, and scientific readings, with support
  for integers, decimals, and scientific notation.
- **[Controlled Number](../field-types/number-fields/controlled-number.md)** — A bounded numeric input
  for ratings, scores, and measurements with minimum and maximum constraints.

### Special Number Fields

- **[QR / Barcode Scanner](../field-types/text-fields/qr-barcode-scanner.md)** — Mobile-only barcode and QR code scanning, supporting multiple barcode formats. This feature can be used to scan preformatted record identifiers. 
- **[Auto Incrementing Field](../field-types/number-fields/auto-incrementing-field.md)** — Generates sequential string identifiers such as specimen numbers and catalogue IDs.

## Date and Time Fields

The **DATE & TIME** tab contains field types for recording dates, times, and
timestamps.

- **[Date time picker](../field-types/date-time-fields/date-time-picker.md)** — Captures date and time
  values. Consider **Date and Time with Now button** instead for timezone
  support.
- **[Date picker](../field-types/date-time-fields/date-picker.md)** — Date-only selection for administrative
  records, permits, and excavation dates.
- **[Month picker](../field-types/date-time-fields/month-picker.md)** — Month-and-year selection for records
  where exact dates are unknown or unnecessary.
- **[Date and Time with Now button](../field-types/date-time-fields/date-time-now.md)** — Timezone-aware
  timestamp capture with an automatic current-time button; the recommended
  date-time field.

## Media Fields

The **MEDIA** tab contains field types for capturing photographs and
uploading files.

- **[Take Photo](../field-types/media-fields/take-photo.md)** — Captures photographs using the device
  camera or gallery, with GPS tagging on native platforms.
- **[Upload a file](../field-types/media-fields/attach-file.md)** — Attaches files of any type from
  the device, queued for synchronisation.

## Location Fields

The **LOCATION** tab contains field types for recording GPS coordinates and
map-based spatial data.

- **[Take point](../field-types/location-fields/take-gps-point.md)** — Single-tap GPS coordinate capture,
  returning a GeoJSON point with accuracy metadata.
- **[Map field](../field-types/location-fields/map-input.md)** — Interactive map for drawing points, lines,
  and polygons on base map tiles.
- **[Address](../field-types/text-fields/address.md)** — Structured address capture storing data in a   geocoding-compatible format. _(**Beta** feature.)_

## Relationship Fields

The **RELATIONSHIP** field type is for connecting records with other records in bidirectional relationships.

- **[Add Related Record](../field-types/relationship-fields/related-records.md)** — Creates bidirectional
  links between records, supporting parent–child and peer relationships.

## Display Fields

**DISPLAY** fields are for presenting static formatted content and instructions within a _Form_. They assist with data capture but recorders cannot input or edit data.

- **[Templated String](../field-types/text-fields/templated-string.md)** — Auto-generates text from other fields using templates; required for human-readable record
  identifiers.
- **[RichText](../field-types/display-fields/rich-text.md)** — Displays formatted instructional content
  and headings within a form; does not capture data.
