#!/usr/bin/env bash
# Pushes the mitmproxy CA certificate into the Android emulator's system trust
# store so that HTTPS interception works for all apps (including Grubhub Campus).
#
# Prerequisites:
#   - Android emulator running with: emulator -avd <name> -writable-system
#   - API level 33 or lower (API 34+ uses APEX certs — not supported by this script)
#   - mitmproxy run at least once (generates ~/.mitmproxy/mitmproxy-ca-cert.cer)
#   - adb and openssl on PATH
set -euo pipefail

CERT_PATH="${HOME}/.mitmproxy/mitmproxy-ca-cert.cer"

# --- Preflight checks ---

for cmd in adb openssl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found on PATH" >&2
    exit 1
  fi
done

if ! adb get-state &>/dev/null; then
  echo "ERROR: No device/emulator connected. Start AVD with -writable-system first." >&2
  exit 1
fi

if [ ! -f "$CERT_PATH" ]; then
  echo "ERROR: mitmproxy CA cert not found at $CERT_PATH" >&2
  echo "Run 'mitmdump' once and exit to generate it." >&2
  exit 1
fi

API_LEVEL=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
echo "Detected API level: $API_LEVEL"

if [ "$API_LEVEL" -ge 34 ]; then
  echo "WARNING: API $API_LEVEL uses APEX-based cert loading." >&2
  echo "System cert injection may not work. Use API 33 or lower." >&2
  read -rp "Continue anyway? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# --- Compute hashed filename ---

HASH=$(openssl x509 -inform PEM -subject_hash_old -in "$CERT_PATH" -noout)
DEST_NAME="${HASH}.0"
TMP_CERT="/tmp/${DEST_NAME}"
trap 'rm -f "$TMP_CERT"' EXIT

# Convert to the format Android expects (PEM block first, then text header)
openssl x509 -inform PEM -in "$CERT_PATH" -out "$TMP_CERT"
openssl x509 -inform PEM -text -fingerprint -noout -in "$CERT_PATH" >> "$TMP_CERT"

echo "Certificate hash: $HASH -> $DEST_NAME"

# --- Disable verified boot and remount system as writable ---

wait_for_boot() {
  adb wait-for-device
  adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 1; done'
}

echo "Step 1/4: Gaining root and disabling verified boot..."
adb root
wait_for_boot
adb shell avbctl disable-verification 2>/dev/null || true

echo "Step 2/4: Rebooting to apply verified boot change..."
adb reboot
wait_for_boot
adb root
wait_for_boot

echo "Step 3/4: Remounting /system as writable..."
adb remount
sleep 2

# --- Push certificate ---

echo "Step 4/4: Pushing certificate to system trust store..."
adb push "$TMP_CERT" "/system/etc/security/cacerts/${DEST_NAME}"
adb shell chmod 644 "/system/etc/security/cacerts/${DEST_NAME}"

echo "Rebooting to finalize..."
adb reboot
wait_for_boot

echo ""
echo "Done. Verify in emulator: Settings > Security > Encryption & credentials >"
echo "Trusted credentials > System tab — look for 'mitmproxy' entry."
