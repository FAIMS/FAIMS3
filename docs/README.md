# Fieldmark Documentation

This directory contains two collections of documentation for Fieldmark.
The `docs` folder contains user facing documentation.  The
[developer](developer/README.md) folder contains internal developer documentation.

## Building User Facing Documentation

Documentation can be built locally using Sphinx or via a docker image. To
build the local docker image with sphinx plugins installed:

```bash
docker build . -t faims-sphinx
```

To build the documentation: 

```bash
docker run --rm -v ./docs:/docs faims-sphinx make html
```
