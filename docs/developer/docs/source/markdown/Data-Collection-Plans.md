# Data Collection Plans

A data collection plan describes a pre-planned collection effort for a
notebook, so the app can present progress against it rather than a flat list
of records. Plans are defined on templates and instantiated when a notebook is
created from the template. A template may carry several plan templates, and
the notebook then carries one plan for each.

## Data model

Plans live in `library/data-model/src/plans`. Each plan type is a
`PlanTypeDefinition` with three schemas and an instantiation function:

- `templateSchema` — what a template stores in `planTemplates` (the plan's
  shape, chosen by the template author).
- `configSchema` — what is supplied as `planConfigs[planId]` when a notebook
  is created (the per-notebook values).
- `planSchema` — the instantiated plan stored in the notebook's `plans`.
- `instantiatePlan({template, config})` — combines the two into a plan. The
  base fields below are the caller's to carry over.

Every plan template and plan carries a `planId` (minted when the plan is
authored, keying its config and addressing it in routes), a `label` (shown
wherever the app names the plan) and an optional `description`. A
`TemplateDefinition` carries `planTemplates`; a `NotebookDefinition` carries
`plans`. The registry (`plans/registry.ts`) maps `planType` to its definition
and installs the built-in types lazily on first lookup, so external modules
can register additional plan types alongside them.

Four built-in plan types exist:

- **Counted** — collect a set number of records of one form. The template
  holds `formType`; the config supplies `numberRequired` and
  `allowExtraRecords`.
- **List of Records** — collect records against a pre-defined list. The
  template holds `formType` and `recordFields`, the subset of the form's
  fields each planned record pre-fills; the config supplies `recordData`,
  a map from a plan reference id to the values for that record, plus
  `allowExtraRecords`. Instantiation filters each record to `recordFields`.
- **List of Forms** — present a set of forms for creating and browsing
  records. The template holds `formTypes`, the forms to present in order;
  the config carries nothing, since the forms are fixed by the template.
  The default notebook view is this view configured from `visible_types`.
- **Map Collection** — collect records against a spatially referenced list.
  The template holds `formType`, `spatialFieldId` (the one map or GPS field of
  the form each planned record's geometry is written to) and `recordFields`,
  the other fields each record pre-fills, each `{fieldId, required}`. The
  config supplies `recordData`, a map from a plan reference id to an entry
  `{fields, spatial}`: the pre-fill values and a GeoJSON FeatureCollection of
  one or more Point, LineString or Polygon features (several features are how
  an entry carries more than one spatial reference), plus `allowExtraRecords`.
  Instantiation filters each entry's fields to `recordFields`, and rejects an
  entry missing a required field or without geometry. The plan carries
  `spatialFieldId` and `recordFields` from the template so the app can write
  the geometry to the right field in the shape that field stores: the
  `MapFormField` a FeatureCollection, the `TakePoint` a single Point feature
  (`mapCollectionSpatialValue`). The GeoJSON schemas the plan uses live in
  `plans/planGeoJson.ts`, kept in data-model so plans do not depend on the
  forms package.

### Spatial import pipeline

A Map Collection config is built from a spatial file by the pipeline in
`plans/spatialImport`, shared by the web manager and any future API upload:

```
source -> format adapter -> explode geometry -> group into entries
       -> extract fields -> build FeatureCollection -> validate -> recordData
```

- A **format adapter** (`formats/`) turns a file into normalised features
  (geometry plus attributes). Every adapter takes the file's text, and each
  also takes its own already-parsed form so a caller holding one need not
  re-serialise it:
  - **GeoJSON** (`formats/geojson.ts`): a FeatureCollection with one Feature
    per planned record; a bare Feature or an empty collection is refused.
    Also takes the parsed JSON value.
  - **KML** (`formats/kml.ts`): one Placemark per planned record, converted
    with [`@tmcw/togeojson`](https://github.com/placemark/togeojson) rather
    than hand-rolled XML handling. Folders and Documents are flattened in
    document order; a MultiGeometry becomes a GeometryCollection for the
    explode stage; a Placemark's `<name>`, `<description>` and
    `<ExtendedData>` (`<Data name=…>` and `<SchemaData><SimpleData name=…>`)
    become properties keyed by that name, so attributes match record fields
    by field id exactly as GeoJSON properties do. GroundOverlays and
    NetworkLinks are dropped; a document with no Placemarks, or whose root is
    not `<kml>`, is refused. XML parsing uses whatever `DOMParser` is on
    `globalThis` (browsers have one; Node callers pass an `@xmldom/xmldom`
    document instead, as the tests do). Also takes a parsed XML document.
    KMZ (zipped KML) is not read.
- **`explodeGeometry`** turns a Multi\* or GeometryCollection into simple
  geometries, so one source feature can yield several spatial references.
- **`groupEntries`** makes one entry per feature; a strategy that groups
  several features under one entry slots in here.
- **`extractFields`** reads `properties[fieldId]` for each record field, by
  field id rather than label, and coerces to the field's `type-returned` as the
  list-of-records table does. Other attributes are dropped.
- **`parseSpatialImport`** runs the stages, checks each entry's geometry suits
  the spatial field (a `MapFormField`'s `featureType`; a `TakePoint` takes one
  Point), applies `mapCollectionEntryIssues`, and mints reference ids
  `planned-1`, `planned-2`… in file order. It reports every problem, by
  feature index, rather than stopping at the first.

Adding a format means a new adapter implementing `SpatialFormatAdapter`, a
member of `SPATIAL_IMPORT_FORMATS`, and an entry in the adapter table in
`pipeline.ts`.

## Instantiation

`POST /api/notebooks` with a `template_id` accepts an optional `planConfigs`,
a map from `planId` to that plan's config. In `createNotebookFromTemplate`
(`api/src/couchdb/templates.ts`), every plan template is validated against
its type's `templateSchema`, must have a config, which is validated against
`configSchema`, and is instantiated with `instantiatePlan` (which may still
reject a schema-valid config that fails the type's own rules, for example a
Map Collection entry missing a required field); the result, with
the template's `planId`, `label` and `description` added, is validated
against `planSchema` and stored in the notebook's `plans` in declared order.
A config for a plan the template does not carry is rejected, since it means
the caller read a different version of the template.

## Authoring plan templates in the Designer

Plan authoring in the Designer (`web/src/designer`) is gated by
`VITE_ENABLE_PLANS_IN_DESIGNER` and appears only when editing a template. The
registry in `web/src/designer/plans.tsx` maps each `planType` to a label,
description and authoring dialog (`components/plans/`). Dialogs gather the
template-schema fields, including the plan's label and description, and
validate against the plan type's authored schema; the store mints the
`planId`. Plan templates are a partition beside `metadata` in the Designer's
state, and templates are normalised with `TemplateDefinitionSchema` so
`planTemplates` survive the round trip.

## Instantiating plans in the web manager

Creating a notebook from a template with plan templates — from the template
detail page (`create-project-from-template.tsx`) or from the notebooks-page
template picker (`create-project-form.tsx`, which fetches the full template
once one is selected) — gathers a config for each plan and sends them as
`planConfigs`; the API performs the validation described above.

Both forms use `usePlanConfigs` (`web/src/components/plans/usePlanConfigs.tsx`),
which resolves each plan template through the config registry
(`registry.ts`, mirroring the Designer's) and handles the two kinds of plan
type it holds:

- **Field-based** types supply `fields(context)` and `toConfig(values, prefix)`.
  Their fields are appended to the create form under a heading carrying the
  plan's label and description, so validation, layout and the disabled-submit
  state come from the shared `Form` module. Field names are prefixed by
  position (`plan0_`, `plan1_`…) because a plan id may contain characters
  react-hook-form would read as a path. Counted is field-based.
- **Component-based** types supply a `ConfigForm` rendered in the form's
  footer as a bordered section, which calls `onChange` with a schema-valid
  config or `undefined` while incomplete. `planSubmissionGate` holds
  submission until every component-based plan has reported a config, the
  template has loaded, and no plan is of an unregistered type. List of Records
  is component-based: an editable table with a column per `recordFields`
  entry, input type following the field's `type-returned` (Integer and Number
  give numeric inputs stored as numbers, Bool a checkbox, everything else
  text). Only fields whose type is in `LIST_PLAN_SUPPORTED_FIELD_TYPES`
  (data-model) get a column; the Designer's picker offers only those, and a
  template that already carries another gets a note that it is entered on
  each record in the app instead. Rows are given sequential
  reference ids that are never reused after removal, since the id becomes the
  record's `planReference` in the app. Map Collection is also component-based:
  a format picker (GeoJSON, KML), a file input, and a preview table of the entries
  the spatial import pipeline read, with every problem the file has listed
  by feature. The config is reported only once the file yields at least one
  valid entry.

A plan whose type has no registered config form shows an explanatory notice
and blocks creation from the web manager. Adding support for a new plan type
means registering a `PlanConfigType` with `registerPlanConfigType` alongside
its data-model and Designer registrations.

## Plan views in the app

The app resolves a view per plan from the plan view registry
(`app/src/gui/components/notebook/plans/`) keyed by `planType`, offers a
chooser when a notebook carries more than one plan, and falls back to the
default notebook view when it has none. Every view receives
`NotebookViewComponentProps`; see the Counted and List of Records views for
the shape. `RecordsTable` takes a `formTypes` prop naming the forms it lists
and shapes its columns for; a plan view passes its own form(s), and the
default view passes `visible_types`.

The Map Collection view (`MapCollectionPlanView`) carries the survey tabs the
default view has — My and Other records of the plan's form, the Overview Map of
saved record geometry, Details and Settings — beside two of its own:

- **Record Map** (`PlanRecordMap`) plots every planned entry's geometry from
  the plan itself, so it needs no record hydration and works before any record
  exists. An entry whose record has been created (a record in `planRecords`
  carrying its `planReference`) is green; one still pending is amber. Tapping a
  feature offers to open the record, or to create it with the entry's fields
  and geometry as initial data (`mapCollectionInitialRecordData`). It sits on
  `@faims3/forms`' `MapComponent`, as the Overview Map does, rather than on the
  `MapWrapper` draw-and-edit dialog the `MapFormField` uses.
- **Planned records** lists the same entries as cards with the same actions.

Extra-record add buttons appear only when the plan allows extra records; they
claim their records for the plan at the plan level (no entry suffix).
