#!/bin/bash -e

# Local development entrypoint. Warns if GDAL is missing (GeoPackage export and
# map-layer ingest) or if the PDF driver is absent.

check_gdal() {
  echo "=========================================="
  echo "Checking GDAL (ogr2ogr, gdalinfo)..."
  echo "=========================================="

  if ! command -v ogr2ogr &>/dev/null || ! command -v gdalinfo &>/dev/null; then
    echo ""
    echo "WARNING: GDAL is not installed or not on PATH."
    echo "GeoPackage export and map-layer ingest will fail until GDAL is installed."
    echo ""
    echo "Install examples:"
    echo "  Ubuntu/Debian:  sudo apt-get install gdal-bin poppler-utils"
    echo "  macOS (Homebrew): brew install gdal poppler"
    echo "  Alpine:         apk add gdal-tools poppler-utils"
    echo ""
    return
  fi

  echo "✓ GDAL available: $(ogr2ogr --version | head -1)"
  if ! gdalinfo --formats | grep -qi pdf; then
    echo ""
    echo "WARNING: GDAL has no PDF driver. Georeferenced PDF uploads will fail."
    echo "Install poppler (Debian: poppler-utils, Homebrew: poppler) and a GDAL build that uses it."
    echo ""
  else
    echo "✓ GDAL PDF driver available"
  fi
  echo ""
}

check_gdal

./localdev.sh
pnpm run migrate-with-keys
pnpm run dev
