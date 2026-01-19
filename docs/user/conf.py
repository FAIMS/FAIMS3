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
release = "1.3.0"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ['myst_parser', 'screenshot', 'sphinx_wagtail_theme']

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store", ".venv"]


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_wagtail_theme'

# These folders are copied to the documentation's HTML output.
html_static_path = ["_static"]
html_css_files = ["custom.css"]

# These are options specifically for the Wagtail Theme.
html_theme_options = dict(
    project_name = project + " Documentation",
    logo = "img/logo-dark.png",
    logo_alt = project,
    logo_height = 59,
    logo_url = "/",
    logo_width = 45,
)

copyright = "2026. FAIMS Project  "
html_show_copyright = True


myst_heading_anchors = 1

myst_enable_extensions = [
    "substitution",
]

NOTEBOOK_NAME = os.getenv("VITE_NOTEBOOK_NAME", "notebook")
DASHBOARD_NAME = os.getenv("VITE_WEBSITE_TITLE", "dashboard")
THEME_NAME = os.getenv("VITE_THEME", "default")

API_URL = os.getenv("VITE_API_URL")
APP_URL = os.getenv("VITE_APP_URL")
WEB_URL = os.getenv("VITE_WEB_URL")
ANDROID_APP_URL = os.getenv("ANDROID_APP_PUBLIC_URL")
IOS_APP_URL = os.getenv("IOS_APP_PUBLIC_URL")


myst_substitutions = {
  "FAIMS": project, # the product name
  "theme": THEME_NAME, # the theme name, used to select screenshots
  "notebook": NOTEBOOK_NAME, # the name of a project (notebook or survey)
  "Notebook": NOTEBOOK_NAME.title(), # variations of the notebook name
  "notebooks": NOTEBOOK_NAME + 's',
  "Notebooks": NOTEBOOK_NAME.title() + 's',
  "dashboard": DASHBOARD_NAME, # the name of the web management app
  "Dashboard": DASHBOARD_NAME.title(),
  "API_URL": "<" + API_URL + ">",
  "APP_URL": "<" + APP_URL + ">",
  "WEB_URL": "<" + WEB_URL + ">",
  "IOS_APP_LINK": "<a href=\"" + IOS_APP_URL + "\">" + project + " IOS App</a>",
  "ANDROID_APP_LINK": "<a href=\"" + ANDROID_APP_URL + "\">" + project + " Android App</a>",
}
