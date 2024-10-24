#!/bin/sh

source .env

npx capacitor-assets generate --assetPath ./public/base-assets/${VITE_THEME} \
  --iconBackgroundColorDark '#001d34' \
  --splashBackgroundColorDark '#001d34'
