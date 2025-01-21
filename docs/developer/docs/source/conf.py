# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

import os
import pathlib

project = 'FAIMS3 Developer Documentation'
copyright = '2025, FAIMS3'
author = 'FAIMS3'


def generate_toctree():
    # Get all .md files recursively
    root_dir = pathlib.Path(__file__).parent
    print(root_dir)
    markdown_files = []

    for path in root_dir.rglob('*.md'):
        # Convert path to relative path from conf.py
        relative_path = path.relative_to(root_dir)
        # Remove .md extension
        markdown_files.append(str(relative_path.with_suffix('')))

    return markdown_files


# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration
extensions = ['myst_parser']

templates_path = ['_templates']
exclude_patterns = []


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'

autobuild_watch = [
    '../src',
    'source'
]

html_static_path = ['_static']

source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

master_doc = 'index'
toctree_files = generate_toctree()

# Create the RST content with the generated TOC
rst_content = """
FAIMS3 Developer Documentation
==============================

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   {}
""".format('\n   '.join(toctree_files))

# Write to index.rst
with open(os.path.join(os.path.dirname(__file__), 'index.rst'), 'w') as f:
    f.write(rst_content)
