#!/bin/bash
# 1) Start emulator and wait for boot
# 2) Then run the app on it

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Use SDK from common locations (Android Studio default)
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

# Prefer $AVD, else first known project AVD, else first installed AVD (Medium_Phone, YoginiAstro_*, etc.)
if [ -z "$AVD" ]; then
  for candidate in YoginiAstro_Phone_ARM YoginiAstro_Phone Medium_Phone; do
    if emulator -list-avds 2>/dev/null | grep -qx "$candidate"; then
      AVD="$candidate"
      break
    fi
  done
  if [ -z "$AVD" ]; then
    AVD="$(emulator -list-avds 2>/dev/null | head -n1)"
  fi
fi
if [ -z "$AVD" ]; then
  echo "No Android Virtual Device found. Create one in Android Studio (Device Manager) or run: npm run android:create-phone"
  exit 1
fi

echo "Starting emulator: $AVD ..."
emulator -avd "$AVD" -no-snapshot-load &
EMU_PID=$!

echo "Waiting for emulator to boot..."
adb wait-for-device

# Wait until boot completed (optional but recommended)
echo "Waiting for boot to complete..."
adb shell 'while [[ -z $(getprop sys.boot_completed 2>/dev/null) ]]; do sleep 2; done'

echo "Emulator is ready. Installing app..."
npx react-native run-android

# Optional: kill emulator when script exits (comment out to leave it running)
# trap "kill $EMU_PID 2>/dev/null || true" EXIT
