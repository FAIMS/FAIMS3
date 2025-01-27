# Fieldmark Documentation

This is suport documentation for users wanting to learn about the Fieldmark Webapp, Android and iOS versions.

## Tech

The docs uses the Sphinx python build system to build a static website from mostly markdown content.

## User docs local deploy

```bash
cd user
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./localPreview.sh
```

To build, all steps the same except the final line

```
make html
```

## Developer docs local deploy

```bash
cd developer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./localPreview.sh
```

To build, all steps the same except the final line

```
cd docs
make html
```
