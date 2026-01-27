# FAIMS3 Local Device Testing via ADB Forward

This guide explains how to test FAIMS3 on a physical Android device when developing on a remote VM via SSH.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Android Phone  │   USB   │  Windows PC     │   SSH   │  Linux VM       │
│                 │◄───────►│                 │◄───────►│                 │
│  FAIMS3 App     │         │  ADB Server     │  -R     │  Dev Server     │
│       │         │         │  (port 5037)    │  5037   │  (port 3000)    │
│       ▼         │         │                 │         │                 │
│  localhost:3000 │◄────────────────adb reverse─────────│  API (8080)     │
│  localhost:8080 │◄────────────────adb reverse─────────│  CouchDB (5984) │
│  localhost:5984 │◄────────────────adb reverse─────────│                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## One-Time Setup

### 1. Android Phone Setup

1. **Enable Developer Options**
   - Settings → About phone → Tap "Build number" 7 times

2. **Enable USB Debugging**
   - Settings → Developer options → Enable "USB debugging"

3. **Set USB Mode**
   - When plugged in, select "File transfer" (MTP) mode from the USB notification

### 2. Windows Setup

1. **Install ADB** (if not already installed)
   - Install Android Studio, or
   - Download platform-tools from Google: https://developer.android.com/tools/releases/platform-tools

2. **Install USB drivers** (if device not recognised)
   - Try universal driver: https://adb.clockworkmod.com/
   - Or your phone manufacturer's driver

3. **Verify ADB sees your device**
   ```powershell
   adb devices
   ```

   - First time: Accept the "Allow USB debugging" prompt on your phone

### 3. Linux VM Setup

1. **Install Java 21**

   ```bash
   sudo apt update
   sudo apt install openjdk-21-jdk

   echo 'export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **Install Android SDK command-line tools**

   ```bash
   mkdir -p ~/android-sdk/cmdline-tools
   cd ~/android-sdk/cmdline-tools
   wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
   unzip commandlinetools-linux-11076708_latest.zip
   mv cmdline-tools latest
   rm commandlinetools-linux-11076708_latest.zip

   echo 'export ANDROID_HOME=~/android-sdk' >> ~/.bashrc
   echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Install SDK packages**

   ```bash
   sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```

4. **Verify installation**
   ```bash
   adb --version
   ```

---

## Each Development Session

### Step 1: Start ADB on Windows

Plugin phone, then:

```powershell
adb kill-server
adb start-server
adb devices
# Confirm your phone is listed
```

### Step 2: SSH to VM with ADB Tunnel

Ensure VS code SSH config setup with (`C:\Users\YourName\.ssh\config`):

```
Host your-vm
    HostName your-vm-ip
    User your-username
    RemoteForward 5037 127.0.0.1:5037
```

### Step 3: Verify ADB on VM

Launch VS code SSH instance and verify:

```bash
adb kill-server    # Kill any local server
adb devices        # Should show your phone
```

### Step 4: Setup ADB Port Forwarding

```bash
adb reverse tcp:3000 tcp:3000   # Dev server
adb reverse tcp:8080 tcp:8080   # API server
adb reverse tcp:5984 tcp:5984   # CouchDB
```

### Step 5: Build

```bash
# From the top level FAIMS
./dev.sh
```

Then from within `/app`:

```bash
# Sync and deploy to device
pnpm cap sync android
```

### Step 6: Switch Capacitor Config

From within `/app`:

```bash
./setup-adb-testing.sh
```

### Step 7: Develop with Live Reload

Build/launch onto android:

From within `/app`:

```bash
# Sync and deploy to device
pnpm cap run android
```

Once the app is installed, changes to web code will hot-reload automatically.
You only need to re-run `cap run android` if you:

- Change Capacitor config
- Add/remove native plugins
- Modify native code

## Viewing Device Logs

### App logs only

First, ensure the app is open on your phone, then:

```bash
adb logcat --pid=$(adb shell pidof -s au.edu.faims.fieldmark)
```

### Filter to JavaScript console output

```bash
adb logcat --pid=$(adb shell pidof -s au.edu.faims.fieldmark) | grep -i "console"
```

### Filter to Capacitor plugin logs

```bash
adb logcat --pid=$(adb shell pidof -s au.edu.faims.fieldmark) | grep -E "(Capacitor|CapacitorHttp)"
```

### Chrome DevTools (recommended for web debugging)

With `webContentsDebuggingEnabled: true` in the Capacitor config, you can use Chrome DevTools:

1. Open Chrome on your Windows machine
2. Navigate to `chrome://inspect`
3. Your app's WebView appears under "Remote Target"
4. Click "inspect" for full DevTools (console, network, sources, etc.)

### Find the correct package name

If `pidof` returns nothing, verify the package name:
```bash
adb shell pm list packages | grep -i faims
```

---

## Troubleshooting

### "remote port forwarding failed for listen port 5037"

Something is already using port 5037 on the VM:

```bash
adb kill-server
lsof -i :5037          # Find what's using it
kill <PID>             # Kill it
```

Then reconnect SSH.

### ADB devices empty on VM

1. Check Windows ADB is running: `adb devices` (should show phone)
2. Ensure SSH tunnel is active
3. Kill any local ADB server on VM: `adb kill-server`

### App can't connect to localhost services

Check ADB reverse tunnels are set up:

```bash
adb reverse --list
```

Should show:

```
(reverse) tcp:3000 tcp:3000
(reverse) tcp:8080 tcp:8080
(reverse) tcp:5984 tcp:5984
```

### Build fails with Java errors

Ensure Java 21 is installed and JAVA_HOME is set:

```bash
java -version          # Should show 21
echo $JAVA_HOME        # Should point to Java 21
```

### Native plugins not working

- Native plugins require the actual APK to be installed on the device
- They won't work in a desktop browser
- Ensure you ran `cap sync` after any plugin changes

---

## Files Reference

| File                                | Purpose                                |
| ----------------------------------- | -------------------------------------- |
| `capacitor.config.json`             | Active Capacitor config                |
| `capacitor.config.adb-forward.json` | Config for ADB device testing          |
| `capacitor.config.backup.json`      | Backup of original config              |
| `setup-adb-testing.sh`              | Script to switch to ADB testing config |
