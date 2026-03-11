#!/bin/bash
# Creates a phone AVD (Android Virtual Device) for running the app.
# Installs Android 34 Google APIs (phone) system image if needed, then creates "YoginiAstro_Phone" AVD.

set -e
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD_NAME="${AVD_NAME:-YoginiAstro_Phone}"
DEVICE="pixel_6"
# Android 35 Google APIs (tablet) + Pixel 6 device = phone-shaped emulator (no extra download)
SYSTEM_IMAGE="system-images;android-35;google_apis_tablet;x86_64"
SYSIMG_PATH="$ANDROID_HOME/system-images/android-35/google_apis_tablet/x86_64"

echo "=== Phone emulator setup ==="
echo "AVD name: $AVD_NAME"
echo "Device: $DEVICE (phone form factor)"
echo ""

# Install system image if not present
if [ ! -d "$SYSIMG_PATH" ]; then
  echo "Installing Android 35 (Google APIs Tablet, x86_64) system image..."
  yes | sdkmanager --install "$SYSTEM_IMAGE"
  echo "System image installed."
else
  echo "System image already present."
fi

# Remove existing AVD with same name so we can recreate
if avdmanager list avd 2>/dev/null | grep -q "Name: $AVD_NAME"; then
  echo "Removing existing AVD '$AVD_NAME'..."
  avdmanager delete avd -n "$AVD_NAME"
fi

echo "Creating AVD: $AVD_NAME (Pixel 6, Android 35)..."
echo no | avdmanager create avd -n "$AVD_NAME" -k "$SYSTEM_IMAGE" -d "$DEVICE" -f

echo ""
echo "Done. Start the phone emulator with:"
echo "  emulator -avd $AVD_NAME"
echo ""
echo "Or run the app (emulator + install):"
echo "  AVD=$AVD_NAME npm run android:emulator"
echo ""
