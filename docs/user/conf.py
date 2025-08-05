# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import sys
from pathlib import Path
sys.path.append(str(Path('_ext').resolve()))

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Fieldmark"
copyright = "2023, Electronic Field Notebooks Pty Ltd"
author = "Electronic Field Notebooks Pty Ltd"
release = "1.2.2"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ['myst_parser', 'screenshot']

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store", ".venv"]


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'alabaster'
html_static_path = ["_static"]

myst_heading_anchors = 1

myst_enable_extensions = [
    "substitution",
]

myst_substitutions = {
  "FAIMS": project,
  "theme": "default",
  "notebook": "notebook",
  "Notebook": "Notebook",
  "notebooks": "notebooks",
  "Notebooks": "Notebooks",
}