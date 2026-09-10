# Milestone 2 Validation — Wi-Fi Discovery & Device Fingerprinting

**Status:** Complete
**Primary platform:** Physical iPhone
**Completion commit:** `f2a0f18` — Complete Milestone 2 WiFi device detection

## Goal

Expand beyond a small TCP-port probe so Sweeper can discover local network hosts, collect safe service evidence, identify network-video clues and explain findings without claiming that network presence proves a hidden camera.

## Implemented

- Private IPv4/subnet discovery
- Native ICMP-assisted host discovery on iOS
- Baseline and targeted TCP service probing
- Native Network.framework TCP/protocol exchange path
- Bonjour/mDNS discovery
- SSDP/UPnP discovery foundation
- HTTP response/header/title fingerprinting
- RTSP OPTIONS protocol interrogation
- Camera/security hostname/service/vendor text hints
- Evidence-based device assessment
- Consumer-safe caution-first UI
- Technical-details/export path
- Backend persistence for discovery sources and protocol fingerprints
- Guardrail that network-only evidence cannot establish a hidden-camera threat

## Physical validation

The physical iPhone reached the known Mac-side network ground truth and autonomously discovered the required network-video test target.

Representative validated result:

```text
[SWEEPER][WIFI] complete records=18 ipv4Hosts=14 icmp=14 rtspConfirmed=1 review=1
[SWEEPER][WIFI][FINGERPRINT][RTSP] ip=192.168.1.226 port=554 confirmed=yes summary=RTSP/1.0 200 OK · Public=OPTIONS, DESCRIBE, SETUP, TEARDOWN, PLAY, GET_PARAMETER
```

Earlier validation runs also observed approximately 15 IPv4/ICMP hosts and 12 TCP-responsive hosts depending on network state.

The important acceptance result was not the exact host count. It was that Sweeper independently found the known RTSP target, confirmed the RTSP protocol response, surfaced one camera/video-related caution, and did not classify generic live hosts as cameras.

## Evidence policy

A confirmed RTSP response is strong evidence that a device is network-video equipment. It does **not** establish:

- that the device is physically in the room,
- that it is concealed,
- that it is recording the user,
- or that its use is improper.

Those conclusions require physical/optical/reporting evidence and later verification safeguards.

## Platform constraints / deferred work

### MAC / OUI

iOS does not expose arbitrary LAN peer MAC addresses to a normal app, so Milestone 2 cannot honestly promise universal iOS MAC/OUI manufacturer identification. OUI support remains appropriate where Android/platform APIs legitimately expose a MAC and as part of the later updateable device-intelligence dataset.

### SSDP / UPnP

SSDP is implemented as an additional signal, but general multicast UDP behavior on physical iOS can depend on network behavior and Apple's multicast entitlement. The core scanner therefore does not depend on SSDP to succeed.

## Regression

Milestone 3 physical validation later reconfirmed that the Wi-Fi scanner still autonomously discovered the RTSP target after the shared scan-UX/BLE changes.

## Exit result

Milestone 2 is complete for the defined iOS scope. Remaining OUI/device-database work belongs to Milestones 14 and 16 rather than reopening Milestone 2.
