# Exporting your data

:::{caution}
The current version of Fieldmark (released December 2022) supports export from the Browser only, using a third-party service. Integrated export is coming in late 2023.
:::

## Available Exports
Data can be exported from Fieldmark into .csv, .kml, .json and other formats, as needed.

## Attachments
Images, files and folders are renamed in accordance with the record's chosen identifier, saving time when you return from the field.     

## Running your exporter (online version)

The 2022 exporter is designed as a Jupyter Notebook. If you have experience with Python, it is runnable from your local machine. Otherwise, follow these instructions.

:::{warning}
The MyBinder service has slowed network traffic to inhibit cryptocurrency mining. This link is intended as a demonstration, but should not be used with projects of more than 10 records.
:::

1. Sign into Fieldmark at https://demo.3.faims.edu.au.
1. Once you have signed in, visit https://demo.conductor.faims.edu.au
1. Scroll down, until you see the section: `Need Bearer Token for Exporting Data?
`
1. On Chrome, click Copy Bearer Token to Clipboard. On Firefox, click show bearer token and triple-click to select the whole thing, then copy.
1. Go to [MyBinder using this link](https://mybinder.org/v2/gh/FAIMS/FAIMS3-Jupyter-Exporter/HEAD?urlpath=voila%2Frender%2Fexporter.ipynb).
1. It may take some time for the kernel to load.
1. Paste your "Bearer Token" into the textbox
1. Choose the notebook you wish to export.
1. Click "Export Notebook"
1. Download your file.
