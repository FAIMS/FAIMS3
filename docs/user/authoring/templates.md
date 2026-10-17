# {{Notebook}} Templates

Data collection and management in {{FAIMS}} is done using {{notebooks}}, but it is common
to re-use the same {{notebook}} structure in multiple data collection exercises. This
facilitates common data structures so that data can be compared between and across
many data collection events. To enable this practice, {{FAIMS}} supports _{{notebook}} templates_
which can be used to create many {{notebooks}}.

## Template Structure

A template uses the same form design structure as a {{notebook}}. Templates are stored in a
separate templates database and can be marked **public** or **archived** for sharing across teams.

## Creating a Template

In the {{dashboard}} web application you can create a new template if you have
permission to do so within your team. Enter a **template name**; you may add an
optional **description** (up to 250 characters). The template can be created
from scratch or from a previously downloaded JSON file (design layout only).

Once the template has been created, you can edit the template as you would a {{notebook}} in the
designer application.

## Creating {{Notebooks}} from a Template

In the {{dashboard}} web application you can create a new {{notebook}} from a template. Enter a
**name**; you may add an optional **description** (up to 250 characters).

The {{notebook}} records the source template on the survey (**template used** in the {{dashboard}})
so you can trace which template it was created from. Design provenance from copying another
definition may also appear as **derived from template** in design metadata when applicable.

The created {{notebook}} is a snapshot copy of the template at time of creation. Any subsequent
changes to the template **will not** be reflected in the {{notebooks}} created from it.

It is possible to make changes to the {{notebook}} that was created from the template using the
{{notebook}} editor.

**Note** we are working on implementing restrictions on changes to fields within {{notebooks}}
derived from templates. A template would be able to assert that a field cannot be changed or
can be hidden but not removed, for example.

## Setup Forms

A template can define a _setup form_: a set of fields that are presented
when a {{notebook}} is created from the template. This is useful for routine
details that apply to the whole {{notebook}} and are known at creation time,
such as the postcode of the survey area, the lead surveyor, or the on-call
officer. The submitted values are stored in the new
{{notebook}}'s metadata (under `metadata.setup` in the design JSON) rather
than as record data, so they describe the {{notebook}} as a whole.

### Authoring the Form

Open the template in the designer application. A **Setup Form** tab appears
beside **Design** and **Info** (the tab is only shown when editing a template,
not a {{notebook}}). From there you can add, edit, reorder and remove fields.
Each field has:

- a **label** shown to the user on the creation form;
- a **name**, the key the value is stored under in the {{notebook}} metadata
  (derived automatically from the label, but editable);
- a **type** — one of _Text_, _Long text_, _Number_, _Date_, _Single select_
  or _Multi select_. The two select types require a list of **options**, one
  per line;
- an optional **required** flag and **helper text**.

Fields are presented in the order listed. Changes are saved with the rest of
the template design and can be undone and redone like other design edits.

### Filling in the Form

When a {{notebook}} is created from a template with a setup form, whether
from the template's own page or by choosing the template in the create
{{notebook}} dialog, the form's fields are shown after the {{notebook}} name
and description. Required
fields must be completed before the {{notebook}} can be created; single and
multi select fields only accept their listed options. The values are validated
again by the server, so a {{notebook}} cannot be created from such a template
without valid setup details.

The setup form definition itself is carried through into the created
{{notebook}}'s design, so a {{notebook}} can later be turned back into a
template without losing the form.
