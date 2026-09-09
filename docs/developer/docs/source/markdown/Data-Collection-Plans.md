# Data Collection Plans

A data collection plan describes a pre-planned collection effort for a
notebook, so the app can present progress against it rather than a flat list
of records. Plans are defined on templates and instantiated when a notebook is
created from the template.

## Data model

Plans live in `library/data-model/src/plans`. Each plan type is a
`PlanTypeDefinition` with three schemas and an instantiation function:

- `templateSchema` — what a template stores as `planTemplate` (the plan's
  shape, chosen by the template author).
- `configSchema` — what is supplied as `planConfig` when a notebook is created
  (the per-notebook values).
- `planSchema` — the instantiated `plan` stored on the notebook.
- `instantiatePlan({template, config})` — combines the two into a plan.

A `TemplateDefinition` carries an optional `planTemplate`; a
`NotebookDefinition` carries an optional `plan`. The registry
(`plans/registry.ts`) maps `planType` to its definition and installs the
built-in types lazily on first lookup, so external modules can register
additional plan types alongside them.

Two built-in plan types exist:

- **Counted** — collect a set number of records of one form. The template
  holds `formType`; the config supplies `numberRequired` and
  `allowExtraRecords`.
- **List of Records** — collect records against a pre-defined list. The
  template holds `formType` and `recordFields`, the subset of the form's
  fields each planned record pre-fills; the config supplies `recordData`,
  a map from a plan reference id to the values for that record, plus
  `allowExtraRecords`. Instantiation filters each record to `recordFields`.

## Instantiation

`POST /api/notebooks` with a `template_id` accepts an optional `planConfig`.
In `createNotebookFromTemplate` (`api/src/couchdb/templates.ts`), if the
template has a `planTemplate` the API validates it against the plan type's
`templateSchema`, requires a `planConfig`, validates that against
`configSchema`, calls `instantiatePlan`, and validates the result against
`planSchema` before storing it as the notebook's `plan`. A template with a
plan cannot be instantiated without a config.

## Authoring plan templates in the Designer

Plan authoring in the Designer (`web/src/designer`) is gated by
`VITE_ENABLE_PLANS_IN_DESIGNER` and appears only when editing a template. The
registry in `web/src/designer/plans.tsx` maps each `planType` to a label,
description and authoring dialog (`components/plans/`). Dialogs gather the
template-schema fields and validate against the plan type's `templateSchema`
before storing. The plan template is a partition beside `metadata` in the
Designer's state, and templates are normalised with `TemplateDefinitionSchema`
so `planTemplate` survives the round trip.

## Instantiating plans in the web manager

Creating a notebook from a template with a `planTemplate` — both from the
template detail page (`create-project-from-template.tsx`) and from the
notebooks-page template picker (`create-project-form.tsx`) — renders a
configuration section for the plan type and gates submission until it is
complete. The notebooks-page form fetches the full template once one is
selected. The config is sent as `planConfig` with the create request; the API
performs the validation described above.

The config forms are registered in `web/src/components/plans/registry.ts`,
mirroring the Designer registry: each `PlanConfigType` maps a `planType` to a
label and a `ConfigForm` component. A config form receives the plan template
and the template's `uiSpec` (for form and field labels) and calls `onChange`
with a schema-valid config, or `undefined` while its input is incomplete or
invalid. The built-in forms validate with `countedPlanTemplateConfigSchema`
and `listPlanTemplateConfigSchema` from the data model.

The List of Records form is an editable table with a column per
`recordFields` entry. Input type follows the field's `type-returned`
(`faims-core::Integer` and `faims-core::Number` give numeric inputs stored as
numbers, `faims-core::Bool` a checkbox, everything else text). Rows are given
sequential reference ids that are never reused after removal, since the id
becomes the record's `planReference` in the app.

A template whose plan type has no registered config form shows an explanatory
notice and cannot be created from the web manager. Adding support for a new
plan type means registering a `PlanConfigType` with `registerPlanConfigType`
alongside its data-model and Designer registrations.

## Plan views in the app

The app resolves a view for a notebook from the plan view registry
(`app/src/gui/components/notebook/plans/planViewRegistry.ts`) keyed by
`planType`, falling back to the default notebook view when the notebook has
no plan or its type is unregistered. Every view receives
`NotebookViewComponentProps`; see the Counted and List of Records views for
the shape.
