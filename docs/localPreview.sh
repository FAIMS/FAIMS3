#!/usr/bin/env bash
cd docs
make clean
cd ..
sphinx-autobuild docs docs/_build/html
