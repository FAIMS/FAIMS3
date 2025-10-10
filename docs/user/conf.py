# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import sys
import os
from pathlib import Path
sys.path.append(str(Path('_ext').resolve()))

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = os.getenv("VITE_APP_NAME", "FAIMS")
copyright = "2023, Electronic Field Notebooks Pty Ltd"
author = "Electronic Field Notebooks Pty Ltd"
release = "1.2.7"

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

NOTEBOOK_NAME = os.getenv("VITE_NOTEBOOK_NAME", "notebook")
DASHBOARD_NAME = os.getenv("VITE_WEBSITE_TITLE", "dashboard")

myst_substitutions = {
  "FAIMS": project, # the product name
  "theme": "default", # the theme name, used to select screenshots
  "notebook": NOTEBOOK_NAME, # the name of a project (notebook or survey)
  "Notebook": NOTEBOOK_NAME.title(), # variations of the notebook name
  "notebooks": NOTEBOOK_NAME + 's',
  "Notebooks": NOTEBOOK_NAME.title() + 's',
  "dashboard": DASHBOARD_NAME, # the name of the web management app
}
