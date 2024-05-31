#!/bin/bash

version=$(grep '"version":' package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
# https://stackoverflow.com/questions/63226248/replace-version-in-info-plist-with-bash-script-for-azure-pipeline

sed -i '' -E '/<key>CFBundleShortVersionString<\/key>/{
           N
           s/(<string>).*(<\/string>)/\1'"$version"'\2/
       }
      ' ios/App/App/Info.plist