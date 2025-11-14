# Form Module for FAIMS3

This module implements the form handling for the FAIMS app. Generating forms from a
notebook specification and handling data capture in the app.

## Structure

The structure of this module is based in part on [this article](https://dev.to/receter/how-to-create-a-react-component-library-using-vites-library-mode-4lma).

The module provides a number of components that are implemented in the `lib` directory.

The `src` directory provides a sample application that can be used to test
components during development.   This is not part of the exported module.

## Scripts

Build the module with:

```bash
pnpm build
```

For development, run the sample application with:

```bash
pnpm dev
```

This will also monitor and live reload the library module.
