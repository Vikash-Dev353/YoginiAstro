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

# Default: YoginiAstro_Phone_ARM (ARM64 phone, for Apple Silicon). Or: YoginiAstro_Phone (x86), Television_1080p
AVD="${AVD:-YoginiAstro_Phone_ARM}"

echo "Starting emulator: $AVD ..."
emulator -avd "$AVD" -no-snapshot-load &
EMU_PID=$!

echo "Waiting for emulator to boot..."
adb wait-for-device

# Wait until boot completed (optional but recommended)
echo "Waiting for boot to complete..."
adb shell 'while [[ -z $(getprop sys.boot_completed 2>/dev/null) ]]; do sleep 2; done'

echo "Emulator is ready. Installing app..."
npx react-native run-android --no-packager

# Optional: kill emulator when script exits (comment out to leave it running)
# trap "kill $EMU_PID 2>/dev/null || true" EXIT
