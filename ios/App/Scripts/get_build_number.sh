#!/bin/bash
#https://mokacoding.com/blog/automatic-xcode-versioning-with-git/

git=$(sh /etc/profile; which git)
number_of_commits=$("$git" rev-list HEAD --count)
git_release_version=$(git describe --long 2>/dev/null || git describe --all --long --always | sed "s#heads/g#${platform}#")

target_plist="$TARGET_BUILD_DIR/$INFOPLIST_PATH"
dsym_plist="$DWARF_DSYM_FOLDER_PATH/$DWARF_DSYM_FILE_NAME/Contents/Info.plist"

for plist in "$target_plist" "$dsym_plist"; do
  if [ -f "$plist" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $number_of_commits#*v" "$plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $number_of_commits#*v}" "$plist"
  fi
done
