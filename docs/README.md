# Project Documentation

This directory contains documentation for the project written using Markdown for
processing with the Sphinx document processing pipeline.

User documentation is in the `user` directory and is meant to be processed for end-user
documentation.   Developer documentation is in the `developer` directory and will generally
just be made available as part of the repository.

## Writing Documentation

For developer documentation, just add markdown formatted files in the `docs/source/markdown` directory.
Since the developer documentation is not intended for user-facing publication, this can be
in whatever form is useful to future developers.

For user facing documentation in the `user` directory, ensure that the documentation is
organised appropriately.  Add any new markdown pages into the `index.md` file so that they
appear in the generated site navigation.

When writing user documentation we need to ensure that names or words that might vary between
different configurations can be replaced appropriately.  We use markdown variable substitutions
to achieve this with variables in {{double-braces}}.  Please use the following in your writing:

- {{FAIMS}} for the name of the product (Fieldmark or Bushfire Surveyor)
- {{notebook}} for the name of a project (notebook or survey), similarly  {{notebooks}}, {{Notebook}}, {{Notebooks}}
- {{dashboard}} for the name of the management web application (dashboard, manager or control centre)

## Build the Documentation

The easiest way to build the docs is via a docker image with Sphinx installed.  The following
commands can be used:

Build the docker image:

```bash
npm run docker:build
```

Build the user documentation in HTML format:

```bash
npm run build:user
```

Build the developer documentation in HTML format:

```bash
npm run build:developer
```

Outputs in each case go into the `build` folder in the respective directory.
