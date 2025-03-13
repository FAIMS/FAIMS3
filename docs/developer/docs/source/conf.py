# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

import os
import pathlib
from typing import List

project = 'FAIMS3 Developer Documentation'
copyright = '2025, FAIMS3'
author = 'FAIMS3'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration
extensions = [
    'myst_parser',
    'sphinxcontrib.mermaid',
]

templates_path = ['_templates']
exclude_patterns = []

# GitHub cross support for mermaid
myst_fence_as_directive = ["mermaid"]

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_book_theme'

autobuild_watch = [
    '../source',
    'source'
]

html_static_path = ['_static']

source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

master_doc = 'index'

# TOC Tree builder - finds all markdown files and builds them into top level toc
# tree


def generate_toctree():
    root_dir = pathlib.Path(__file__).parent
    docs = []
    for path in root_dir.rglob('*.md'):
        relative_path = str(path.relative_to(root_dir))
        docs.append(relative_path)
    return docs


def generate_rst_content(docs: List[str]):
    # Top-level toctree
    rst_lines = [
        "FAIMS3 Developer Documentation",
        "==============================",
        "",
        ".. toctree::",
        "   :maxdepth: 3",
        "   :caption: Contents:",
        ""
    ]

    for doc in docs:
        rst_lines.append(f"   {doc}")

    return rst_lines


# Create the RST content
hierarchy = generate_toctree()
rst_content = "\n".join(generate_rst_content(hierarchy))

# Write to index.rst
index_path = os.path.join(os.path.dirname(__file__), 'index.rst')
with open(index_path, 'w') as f:
    f.write(rst_content)

print(f"Generated index.rst at: {index_path}")
print("Generated content:")
print(rst_content)
