#!/usr/bin/env bash
make clean

# sphinx-autobuild docs docs/_build/html
sphinx-autobuild . _build/html
