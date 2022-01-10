#!/bin/bash
#https://mokacoding.com/blog/automatic-xcode-versioning-with-git/

buildNumber=$(date -u "+%Y%m%d%H%M")

target_plist="$TARGET_BUILD_DIR/$INFOPLIST_PATH"
dsym_plist="$DWARF_DSYM_FOLDER_PATH/$DWARF_DSYM_FILE_NAME/Contents/Info.plist"

for plist in "$target_plist" "$dsym_plist"; do
  if [ -f "$plist" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $buildNumber#*v" "$plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $buildNumber#*v}" "$plist"
  fi
done
