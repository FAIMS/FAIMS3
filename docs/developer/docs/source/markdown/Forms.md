# Forms Architecture

Here we document the way that forms are constructed and managed within the app. This follows
the major refactor of forms replacing the original RecordForm with a better structured implementation.

## Form Manager

There is a form manager that handles form state and updates to the database.

## Form Fields

See also [Fields](Fields.md) for detailed documentation on how to add new fields (which will need updating).

## Record Validation

There is a record validation module that is used for form validation as well as to ensure that other updates
to project data are valid.

