# Form Design Patterns

*Practical patterns for combining field types in fieldwork forms.*

---

## Overview

Once you have chosen the right field types for your data (see
[Choosing a Field Type](field-selection-guide.md)), the next step is
combining them into effective forms. This guide presents five composite
patterns — recurring field combinations that solve common recording
tasks — and worked examples from archaeology, ecology, and geology.

Good form design favours recognition over recall: let users select from
lists rather than remember codes. Use progressive disclosure to keep
forms simple by default, revealing detailed fields only when needed.
Maintain consistent interaction patterns throughout a {{notebook}} so that
collectors learn the form once and can work quickly.

For a complete list of available field types, see
[Field Types](field-type-index.md).

## Composite Patterns

These five patterns appear across disciplines whenever fieldwork forms
need to go beyond single-field recording.

### The Measurement Pattern

When recording a measurement, combine:

- A **Select one option** or **[Select Field](select.md)** for the
  measurement type (e.g., length, width, depth).
- A **Controlled Number** for the numeric value, with minimum and
  maximum bounds set to catch entry errors.
- A unit indicator — either included in the field label (e.g.,
  "Depth (cm)") or as a separate **Select one option** field if
  multiple units are possible.
- An **Annotation** enabled on the number field for recording
  uncertainty, instrument used, or measurement conditions.

### The Identification Pattern

When recording an identification that may be provisional, combine:

- A **[Select Field](select.md)** or
  **Select Field (Hierarchical)** for the identification (e.g.,
  species, soil type, artefact class) drawn from a controlled
  vocabulary.
- Use of "Uncertainty" if a simple "certain" vs. "uncertain"
  flag is all that is needed, **OR**
- A **Select one option** for more nuanced confidence level (e.g., Certain,
  Probable, Possible, Unlikely).
- A **[Checkbox](checkbox.md)** labelled "Requires verification",
  conditionally revealed when confidence (selected through
  Select one option) is not Certain.
- A **Multi-line Text Field** for detailed notes, conditionally
  revealed alongside the verification flag.

### The Complex Observation Pattern

When structuring complex observations with multiple possible outcomes,
combine:

- A **Select one option** for the observation type, which acts as a
  branching gateway.
- Type-specific field groups revealed conditionally based on the
  selection.
- Standard metadata captured automatically by the platform (recorder,
  timestamp, location).
- A **Take Photo** field with Annotation enabled for visual
  documentation.

### The Progressive Detail Pattern

When a form needs to support both rapid and detailed recording,
combine:

- Basic fields that are always visible for quick recording.
- A **[Checkbox](checkbox.md)** as a gateway question (e.g., "Record
  detailed measurements?").
- Detailed fields conditionally revealed when the checkbox is ticked.

This pattern keeps the form simple for routine records while still
enabling depth when needed.

### The "Other" Specification Pattern

When a controlled vocabulary needs an escape hatch for exceptions,
combine:

- A **[Select Field](select.md)** or **Select one option** with an
  "Other" option included in the list.
- A **[FAIMS Text Field](faims-text-field.md)** conditionally revealed
  when "Other" is selected, prompting the collector to specify.

This preserves the structure of controlled data while allowing
flexibility for unanticipated values.

## Discipline-Specific Examples

The patterns above can be adapted to suit different fieldwork
disciplines. The examples below illustrate common field combinations
and human-readable identifier (HRID) structures.

### Archaeological Recording

Archaeological forms typically need to capture stratigraphic
relationships, contextual inheritance, and structured identifiers:

- **Stratigraphic relationships** — Use **Related Records** with
  defined vocabulary pairs (e.g., "cuts / cut by", "fills / filled by",
  "above / below") to record temporal and physical relationships between
  contexts (temporal and physical relationships can be
  captured independently using multiple relationships).
- **Contextual inheritance** — Finds inherit context properties,
  samples inherit environmental conditions, and photos inherit spatial
  coordinates through parent–child record relationships.
- **HRID structure** — A typical archaeological identifier combines
  site, trench, entity type, and number:
  `SITE-TRENCH-FEATURETYPE-NUMBER` (e.g., "Perachora-T5-Hearth-023").

### Ecological Survey

Ecological survey forms often centre on transect-based observation and
abundance estimation:

- **Transect observations** — Use an **Auto Incrementing Field** for
  sequential observation points, combined with **Take GPS Point** for
  each location along a transect.
- **Abundance estimation** — Use **Controlled Number** fields for
  percentage cover or species counts, or a **Select one option** field
  for categorical scales (e.g., DAFOR: Dominant, Abundant, Frequent,
  Occasional, Rare).
- **HRID structure** — A typical ecological identifier combines
  transect, point, and date:
  `TRANSECT-POINT-DATE` (e.g., "T1-P5-20240315").

### Geological Sampling

Geological forms often involve deep sample hierarchies and orientation
data:

- **Sample hierarchies** — Use **Related Records** to maintain
  provenance through processing stages: Outcrop → Sample → Subsample →
  Analysis.
- **Orientation data** — Use grouped **Controlled Number**
  fields for strike and dip measurements or plunge and trend
  for linear features.
- **Sample identifiers** — Use QR / Barcode Scanner to scan
  a sample label in the field to avoid transcription errors
  (consider implementing IGSNs).
- **HRID structure** — A typical geological identifier combines
  project, location, and sample:
  `PROJECT-LOCATION-SAMPLE` (e.g., "GEO2024-OUT3-S045").
