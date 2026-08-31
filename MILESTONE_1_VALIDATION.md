# Milestone 1 - Physical iPhone Validation

Status: COMPLETE

## Test device

Physical iPhone running iOS 18.1.

The application was built with Xcode 26.3 and installed directly on physical hardware.

## Validated

- Development signing and provisioning
- Application installation and launch
- iOS Location Services permission
- Fresh high-accuracy GPS
- GPS workflow gating
- Local Network permission
- Wi-Fi scan execution
- Bluetooth permission
- Real BLE discovery
- BLE RSSI collection
- BLE advertised-name collection
- BLE service UUID collection
- Camera permission
- Rear-camera preview
- Lens Assist
- Evidence-photo capture
- Sweep summary
- Mobile-to-backend communication
- Server-side risk calculation
- PostgreSQL scan persistence
- Evidence-photo upload and persistence

## GPS results

Physical-device testing produced accurate GPS fixes, including approximately
4-12 meter accuracy.

The workflow now blocks progression without a sufficiently accurate GPS fix.

## Bluetooth results

Real-device testing detected approximately 25-26 nearby BLE devices.

The initial risk implementation incorrectly allowed generic strong unnamed BLE
advertisements to inflate hidden-camera concern.

This was corrected.

RSSI/proximity alone no longer contributes hidden-camera risk. BLE risk must
eventually come from camera/security-specific fingerprints such as advertised
names, service UUIDs or manufacturer data.

The complete BLE list is currently too verbose and will be condensed during the
BLE detection-depth milestone.

## Wi-Fi results

The current TCP-port-based Wi-Fi scan executed successfully on physical
hardware but did not identify known cameras present on the test network.

This is an important validation result rather than a completed detection test.

The current scanner is therefore considered insufficient for production
camera discovery.

Milestone 2 will add:

- Bonjour/mDNS discovery
- SSDP/UPnP discovery
- host/service identification
- richer TCP fingerprints
- camera/NVR/DVR signatures
- manufacturer fingerprints
- OUI matching where the operating system exposes MAC data

The known-camera test network will be used as the Milestone 2 acceptance test.

## Backend validation

Successful scan persisted:

2830e8e7-00e8-48ef-882c-7ff9c740936a

Risk:
20 / Low concern

Evidence photos:
0

Successful end-to-end evidence scan persisted:

a603392f-24a9-41b4-a5c0-8c4fa26e8618

Risk:
0 / No indicators

Evidence photos:
1

This proves:

iPhone -> sweep -> evidence photo -> API -> PostgreSQL

## Repository correction

The React Native application was originally created as a nested Git repository
and the outer repository ignored `mobile/`.

The nested `.git` metadata was backed up and removed.

The live React Native iOS/Android project is now tracked directly by the primary
sumcoinlabs/sweeper repository.

## Known remaining limitations

These belong to later milestones and do not block Milestone 1 completion:

- Current Wi-Fi discovery is not sufficiently deep.
- BLE presentation needs grouping/filtering.
- BLE device fingerprinting is incomplete.
- Automatic street-level GPS property identification remains incomplete.
- Lens/IR frame analysis remains incomplete.
- Community property intelligence remains incomplete.
