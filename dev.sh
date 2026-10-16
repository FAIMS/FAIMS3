#!/bin/bash -e

# Local development entrypoint. Warns if GDAL, tippecanoe, or pmtiles is
# missing. GeoPackage export runs on the API host. Map-layer ingest runs in
# the spatial-worker container (docker compose), which has its own GDAL.

check_gdal() {
  echo "=========================================="
  echo "Checking GDAL, tippecanoe, unzip, and pmtiles..."
  echo "=========================================="

  if ! command -v ogr2ogr &>/dev/null || ! command -v gdalinfo &>/dev/null; then
    echo ""
    echo "WARNING: GDAL is not installed or not on PATH."
    echo "GeoPackage export will fail until GDAL is installed."
    echo "Map-layer ingest runs in the spatial-worker container, not on the host."
    echo ""
    echo "Install examples:"
    echo "  Ubuntu/Debian:  sudo apt-get install gdal-bin poppler-utils tippecanoe"
    echo "  macOS (Homebrew): brew install gdal poppler tippecanoe"
    echo "  Alpine:         apk add gdal-tools gdal-driver-pdf gdal-driver-webp gdal-driver-png gdal-driver-jpeg poppler-utils"
    echo ""
  else
    echo "✓ GDAL available: $(ogr2ogr --version | head -1)"
    if ! gdalinfo --formats | grep -qi pdf; then
      echo ""
      echo "WARNING: GDAL has no PDF driver. Georeferenced PDF uploads will fail."
      echo "Install poppler (Debian: poppler-utils, Homebrew: poppler) and a GDAL build that uses it."
      echo ""
    else
      echo "✓ GDAL PDF driver available"
    fi
    if ! gdalinfo --formats | grep -qi mbtiles || ! gdalinfo --formats | grep -qi webp; then
      echo "WARNING: GDAL is missing the MBTiles or WEBP driver. Raster map layers will fail."
    fi
  fi

  if ! command -v tippecanoe &>/dev/null; then
    echo "WARNING: tippecanoe is not on PATH. Vector map layers will fail."
    echo "  Ubuntu/Debian: sudo apt-get install tippecanoe"
    echo "  macOS (Homebrew): brew install tippecanoe"
  else
    echo "✓ tippecanoe available"
  fi

  if ! command -v unzip &>/dev/null; then
    echo "WARNING: unzip is not on PATH. Zipped File Geodatabase layers will fail."
    echo "  Ubuntu/Debian: sudo apt-get install unzip"
    echo "  macOS (Homebrew): unzip is usually already installed"
  else
    echo "✓ unzip available"
  fi

  if ! command -v pmtiles &>/dev/null && ! command -v go-pmtiles &>/dev/null; then
    echo "WARNING: pmtiles is not on PATH. Host GeoPackage export does not need it;"
    echo "map-layer ingest uses pmtiles inside the spatial-worker image."
    echo "Install go-pmtiles v1.28.1 and put the pmtiles (or go-pmtiles) binary on PATH."
  else
    echo "✓ pmtiles CLI available"
  fi
  echo ""
}

check_gdal

./localdev.sh
pnpm run migrate-with-keys
pnpm run dev
