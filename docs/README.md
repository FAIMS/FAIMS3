# Project Documentation

This directory contains documentation for the project written using Markdown for
processing with the Sphinx document processing pipeline.

User documentation is in the `user` directory and is meant to be processed for end-user
documentation.   Developer documentation is in the `developer` directory and will generally
just be made available as part of the repository.

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

