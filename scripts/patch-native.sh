#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"
PLIST="$MOBILE/ios/SweeperMobile/Info.plist"
MANIFEST="$MOBILE/android/app/src/main/AndroidManifest.xml"

if [[ ! -f "$PLIST" || ! -f "$MANIFEST" ]]; then
  echo "Expected React Native project not found at $MOBILE"
  echo "Run scripts/setup-m1.sh first."
  exit 1
fi

python3 - "$PLIST" <<'PY'
import plistlib, sys
path = sys.argv[1]
with open(path, 'rb') as f:
    data = plistlib.load(f)

data['NSCameraUsageDescription'] = 'Sweeper uses the camera to help inspect suspicious objects and capture evidence photos.'
data['NSLocationWhenInUseUsageDescription'] = 'Sweeper uses your location to tag the property being swept.'
data['NSBluetoothAlwaysUsageDescription'] = 'Sweeper scans nearby Bluetooth devices as one signal in a room sweep.'
data['NSLocalNetworkUsageDescription'] = 'Sweeper checks reachable services on the Wi-Fi network you are currently using.'
ats = data.setdefault('NSAppTransportSecurity', {})
ats['NSAllowsLocalNetworking'] = True

with open(path, 'wb') as f:
    plistlib.dump(data, f, sort_keys=False)
PY

python3 - "$MANIFEST" <<'PY'
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
ANDROID = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ANDROID)
name_attr = f'{{{ANDROID}}}name'
max_sdk_attr = f'{{{ANDROID}}}maxSdkVersion'

permissions = [
    ('android.permission.INTERNET', None),
    ('android.permission.ACCESS_NETWORK_STATE', None),
    ('android.permission.ACCESS_FINE_LOCATION', None),
    ('android.permission.CAMERA', None),
    ('android.permission.BLUETOOTH', '30'),
    ('android.permission.BLUETOOTH_ADMIN', '30'),
    ('android.permission.BLUETOOTH_SCAN', None),
    ('android.permission.BLUETOOTH_CONNECT', None),
]

tree = ET.parse(path)
root = tree.getroot()
existing = {el.attrib.get(name_attr) for el in root.findall('uses-permission')}
insert_index = 0
for permission, max_sdk in permissions:
    if permission in existing:
        continue
    attrs = {name_attr: permission}
    if max_sdk:
        attrs[max_sdk_attr] = max_sdk
    root.insert(insert_index, ET.Element('uses-permission', attrs))
    insert_index += 1

application = root.find('application')
if application is not None:
    # Development only. Production should use HTTPS and remove this.
    application.set(f'{{{ANDROID}}}usesCleartextTraffic', 'true')

tree.write(path, encoding='utf-8', xml_declaration=True)
PY

echo "Patched iOS and Android permissions."
