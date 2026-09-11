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

`POST /api/notebooks` with a `template_id` accepts an optional `planConfigs`,
a map from `planId` to that plan's config. In `createNotebookFromTemplate`
(`api/src/couchdb/templates.ts`), every plan template is validated against
its type's `templateSchema`, must have a config, which is validated against
`configSchema`, and is instantiated with `instantiatePlan`; the result, with
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
  record's `planReference` in the app.

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
the shape.
