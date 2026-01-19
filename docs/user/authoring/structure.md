# {{Notebook}} Structure

A {{FAIMS}} {{notebook}} is a collection of _forms_ that can be used to record data in
the field.  This page describes the structure of a {{notebook}} and the options you have
for setting up your data collection forms.

All of this section also applies to [templates](./templates.md) which share the same structure as {{notebooks}}.

## Metadata

Every {{notebook}} has associated metadata that records properties of the {{notebook}} as a
while.  There are a number of fixed fields in the metadata but you can also add your own
field.  The fixed fields are:

- __Title__: the published name of the {{notebook}} as it will appear in the app
- __Project Lead__: the name of the person running this project (this can be different to the name of the user who creates the {{notebook}})
- __Lead Institution__: the name of the organisation that owns the project
- __Description__: A rich text description of the notebook that will appear in the notebook summary in the app and on the {{dashboard}}
- __Notebook Version__: A version number for your notebook, this can be used if you make changes to indicate different versions of your forms
- __Enable QR Code Search__: A checkbox that enables users of your notebook to use a QR code scan to find records on their device

## {{Notebook}} Design

The main part of the {{notebook}} structure relates to the design of the data collection forms.
A {{notebook}} can contain one or more _forms_; each form will generally correspond to a
thing that you might observe or create a record of.  Since you can have multiple forms within
your {{notebook}}, it is useful to think about how to split up your observations into
distinct parts.  The way that you do this can often facilitate your later analysis of the data.

You will see later that you can define _relationships_ between forms; this can be useful if, for example,
you want to associate many trees with a plantation or create records every time you change the SD card
in your camera trap.

A form consists of one or more _sections_ and each section contains one or more _fields_.  Fields
are the base building block of your forms where users will enter data.  Sections are
arranged in order within your form and you can use them to create shorter pages for data
collection or define a workflow sequence that your users should follow.

### Form Name

The form name is important in the presentation of the {{notebook}} to users.   It should be
the name of the thing that you are documenting. It will appear in the create new record
button as _"Add New XXX"_ (or in shortened form if there are many buttons as _"+ XXX"_).
You should use a name that fits, so 'Tree Observation' rather than 'Form for Tree Observations'.

### Form Settings

```{screenshot} designer/designer-form-settings-desktop.png
:alt: Form settings in the {{notebook}} editor
:width: 100%
```

A form has a number of settings that can change the behaviour of the form. These are shown here in
the screenshot from the {{notebook}} editor.

__Finish Button Behaviour__ Changes the behaviour of the 'Finish' buttons in the form. These can be
shown at the end of every section, only shown once all sections have been visited, or
only shown when there are no errors in the form.  Note that, if the buttons are not shown,
then users cannot cleanly exit the record.

__Layout Style__ allows you to choose to show section within the form on different pages  (tabs)
or in a single page (inline). The
inline display will separate the sections with a heading (the section title).

__Summary Fields__ allows you to select which fields will be displayed in the summary
table listing existing records.  This can be useful to get a quick overview of the
records that have been collected. The display will adapt to the browser or device width,
so all summary fields may not be able to be displayed at all times.

__Human Readable ID Field__ it is useful to have a human readable identifier for each record. This
option allows you to select which field is used for this purpose.   This would often be
a Templated String Field that contains an informative name for the record.

Another setting that is shown at the top of the page in the form editor is _Include "Add New Record" button_.
If this is checked, then the app will show a button to create a new record from this form
in the {{notebook}}.   You would not check this if the form were intended to be a _child record_ for
another form; in that case, you would create child records from within the parent form
rather than from the main {{notebook}} page.

### Conditional Sections

Sections within a form group fields together as part of a workflow or just to break up
a long form into pages.   A useful feature is to be able to show a section conditionally based
on the value entered for a field in an earlier section.

```{screenshot} designer/section-condition.png
:alt: Editing the condition on a section of the form
:width: 100%
```

In this example we have chosen a 'Select' field for the condition and we can choose which value
must be selected to have this section displayed.   Alternately we could have a condition
that asked for one of a number of values. Conditions can be complex and nested as required
to express the logic of your workflow.  For more details see the [page on Conditions](./conditions.md).

### Fields

```{screenshot} designer/editor-text-field.png
:alt: Editing a text field
:width: 100%
```

Fields are the basic building block of a {{notebook}} form and there are many [field types](field-type-reference-table.md)
to choose from in building your form.  The configuration of each field type is different
but the editor view of a text field here shows the common properties of all fields.

A field has a _Label_ that is a human readable name for the field, this is presented to the user
and shown in most places where we refer to the field.  There is also a _Field ID_ which is an
internal identifier - this needs to have no spaces and be unique within the {{notebook}}. The
field ID is usually derived from the label but you can change it if you wish.  You will see
the field ID when you export data as the column name for this field in the exported CSV file.

There are two options for adding helper text to a field.  The main _"Helper Text"_
box that you see here will add text that appears next to the field as a prompt to the
user.  If you want to include more extensive help, you can enter rich text by checking
the _"Include advanced helper text"_ checkbox.  This will create a help icon next to the
field which the user can click on to see the help text.

In the lower half of the configuration panel you can set a number of options for the field.
The _Required_ checkbox indicates whether this field is required; if a required field
is missing this will show as an error to users, although they will still be able to finish
and save their data.  

The _Annotation_ and _Uncertainty_ checkboxes enable the option to
add these during data entry.  An annotation is a textual note associated with the field value.
Uncertainty includes an additional checkbox associated with the value.  You can
change the names of these to suit your purpose.   So, you might label the annotation
as 'User Note' and the uncertainty checkbox as 'Reading unclear' for example.  These
have no special meaning to the system, they are purely a way to include extra data
alongside any data you are capturing in the form.

There is also the option here to add a condition to the field.  This will mean that the
field would only be shown if the condition is met. See the [page on conditions](./conditions.md)
for details.

The final two checkboxes relate to the behaviour of the system in relation to other records.
_Copy value to new records_ means that whatever the most recent value of this field is, that
will be pre-copied into the same field when the next record is created.   This is useful if
you are collecting data in a location and one value - eg. the site address - is the same
for many records.

The _Display in child records_  checkbox configures whether the value of this field will
be available to view in any child records that are created.  This might be used to have
the site name visible while filling out details of a building on the site, for example.
