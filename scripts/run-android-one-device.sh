#!/usr/bin/env bash
# Run RN Android against exactly one device/emulator. Avoids install failures when
# multiple targets are connected (adb "more than one device") and lets you pick the phone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

listed="$(adb devices | awk '/\tdevice$/{print $1}' | wc -l | tr -d ' ')"
if [[ "$listed" -eq 0 ]]; then
  echo "No Android devices/emulators in 'adb devices'. Connect USB or start an emulator."
  exit 1
fi

if [[ "${1:-}" != "" ]]; then
  exec npx react-native run-android --deviceId "$1"
fi

if [[ "${listed}" -gt 1 ]]; then
  echo "Multiple devices connected. Pick one (fixes flaky installs / wrong target):"
  adb devices -l
  echo ""
  echo "Usage: npm run android:device -- <serial_from_first_column>"
  echo "Example: npm run android:device -- 73d8e1b5"
  exit 1
fi

exec npx react-native run-android
