# Milestone 3 - BLE Detection Depth & Scan UX

Status: COMPLETE

Validated on a physical iPhone on 2026-09-01 13:34:21.

## Bluetooth validation

- Physical BLE scan completed successfully.
- Ten-second BLE collection captured repeated advertisements rather than relying on a single RSSI sample.
- Invalid positive RSSI sentinel values such as +127 are filtered before proximity calculations.
- Strong or anonymous Bluetooth signals do not create camera warnings by themselves.
- Known/common devices can be recognized without being classified as threats.
- Camera/security cautions require camera-specific identity or fingerprint evidence.
- Bluetooth-only evidence cannot establish a hidden-camera threat.
- Animated beacon-style scanning experience physically validated.
- Consumer-facing results and recognition summaries physically validated.
- Export Findings functionality included.

Latest physical result:

```
 LOG  [SWEEPER][BLE] complete records=25 cautions=0 named=6 withServices=2 withManufacturerData=1 recognized=6
```

## Wi-Fi regression validation

Milestone 2 functionality remained operational after the shared scan UX changes.

- Physical Wi-Fi scan completed.
- Animated multi-stage discovery/check/confirmation UX validated.
- Known network-video test target remained autonomously discoverable.
- RTSP protocol confirmation remained successful.

Latest physical result:

```
 LOG  [SWEEPER][WIFI] complete records=18 ipv4Hosts=14 icmp=14 rtspConfirmed=1 review=1
 LOG  [SWEEPER][WIFI][FINGERPRINT][RTSP] ip=192.168.1.226 port=554 confirmed=yes summary=RTSP/1.0 200 OK · Public=OPTIONS, DESCRIBE, SETUP, TEARDOWN, PLAY, GET_PARAMETER
```

## Detection limitations

Sweeper does not claim to discover every nearby Wi-Fi or Bluetooth device. BLE devices must be advertising during the scan, and network devices may sleep, ignore discovery traffic, expose no identifiable services, or otherwise remain unclassifiable.

The system therefore combines Wi-Fi and BLE evidence with later physical, lens/IR, photographic, property, and community evidence rather than treating a single radio/network observation as proof of a hidden camera.

## Milestone result

Milestone 3 BLE Detection Depth and shared scanning UX are physically validated and complete.
