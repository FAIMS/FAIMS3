adb reverse tcp:3000 tcp:3000   # Dev server
adb reverse tcp:8080 tcp:8080   # API server
adb reverse tcp:5984 tcp:5984   # CouchDB
# Sync to android build
pnpm cap sync android
# Replace config with local debugging version
./setup-adb-testing.sh
# Deploy to device
pnpm cap run android
