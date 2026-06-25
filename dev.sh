#!/bin/bash -e

# Local development entrypoint. Warns if GDAL is missing (needed for GeoPackage export only).

check_gdal() {
  echo "=========================================="
  echo "Checking GDAL (ogr2ogr)..."
  echo "=========================================="

  if ! command -v ogr2ogr &>/dev/null; then
    echo ""
    echo "WARNING: GDAL ogr2ogr is not installed or not on PATH."
    echo "GeoPackage export will fail until GDAL is installed."
    echo ""
    echo "Install examples:"
    echo "  Ubuntu/Debian:  sudo apt-get install gdal-bin"
    echo "  macOS (Homebrew): brew install gdal"
    echo "  Alpine:         apk add gdal-tools"
    echo ""
    return
  fi

  echo "✓ GDAL available: $(ogr2ogr --version | head -1)"
  echo ""
}

check_gdal

./localdev.sh
pnpm run migrate-with-keys
pnpm run dev
