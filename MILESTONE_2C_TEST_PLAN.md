# Milestone 2C - Host Discovery and Protocol Fingerprinting Test Plan

Status: COMPLETE — archived implementation/physical-test history

Milestone 2 is closed. Final acceptance is summarized in `MILESTONE_2_VALIDATION.md`.

## Added in this build

- Native ICMP-assisted IPv4 /24 host discovery on iOS
- No camera-risk score merely for responding to ICMP
- Baseline TCP discovery across the local /24
- Expanded targeted TCP probing for hosts proven alive
- Explicit local-address binding for React Native TCP probes
- RTSP OPTIONS protocol interrogation
- HTTP header/title fingerprint extraction
- Camera/security fingerprint hints from protocol responses
- Structured `[SWEEPER][WIFI]` terminal diagnostics
- UI metrics for IPv4, ICMP, TCP, Bonjour, SSDP and confirmed RTSP
- Backend persistence for ICMP and protocol-fingerprint evidence

## Physical acceptance requirements

The test network identity remains intentionally blind.

1. Sweeper should discover substantially more of the LAN than the prior
   Bonjour-only view.
2. ICMP-responsive hosts must not be labeled as cameras merely for existing.
3. Sweeper must autonomously discover `192.168.1.226`.
4. Sweeper must detect TCP 554 on `192.168.1.226`.
5. Sweeper must obtain a valid RTSP response from `192.168.1.226`.
6. Additional installed camera identities remain undisclosed until Sweeper
   has been given a blind detection attempt.
7. Results must be reviewed from structured physical-iPhone logs before
   committing this milestone.

## Known platform constraint

SSDP/UPnP remains implemented as an additional signal. General multicast UDP
on physical iOS may require Apple's multicast networking entitlement, so the
core scanner must remain useful without relying on SSDP.

## 2C.1 correction

The first physical 2C run found only 5 ICMP responders and zero TCP services,
so it failed the mandatory RTSP target.

2C.1 changes iOS TCP scanning and protocol exchange to native Network.framework,
paces and retries ICMP per host, and broadens the whole-subnet baseline port set.
At that stage it remained uncommitted until physical validation passed.

## 2C.2 consumer UI simplification

Physical 2C.1 validation reached the Mac-side ground truth:

- 15 IPv4 hosts discovered by the physical iPhone
- 15 ICMP-responsive hosts
- 12 TCP-responsive hosts
- `192.168.1.226:554` autonomously discovered
- RTSP OPTIONS returned `RTSP/1.0 200 OK`
- one camera/video-related caution correctly surfaced

The default Wi-Fi screen is now caution-first and consumer-facing:

- no raw device wall by default
- no meaningless `FOUND` or `REVIEW` labels
- plain-language explanation of the caution
- explicit next action for the user
- IP addresses, ports and protocols moved behind `SHOW TECHNICAL DETAILS`
- generic live hosts do not create camera warnings

A camera that is live on the LAN but exposes no identifiable service remains
an unknown host on iOS. Host presence alone is intentionally not treated as
camera evidence.

## 2C.3 evidence intelligence, export, and reporting guardrail

Physical testing repeatedly confirmed the mandatory RTSP target at
`192.168.1.226:554` with a standards-compliant `RTSP/1.0 200 OK` response.

This revision explicitly separates:
1. confidence that a device is network video/camera equipment
2. confidence that a hidden-camera threat exists at the property

A confirmed RTSP response is strong network-video evidence and is retained for
backend review. Network evidence alone is never sufficient to label a property
as a hidden-camera threat because it cannot establish physical placement,
concealment, or improper use.

The user-facing Wi-Fi screen now:
- shows only camera/video cautions
- describes the likely class of equipment in plain language
- states the evidence strength
- explains what the finding does and does not prove
- gives a concrete next step
- removes raw IP/port/protocol detail from the normal UI
- supports exporting a shareable report with a technical appendix

Structured assessment/evidence codes are retained in the scan JSON so the
backend can later correlate network evidence with physical, photo, IR, BLE,
prior-report, and property evidence.

Future public reporting must require multiple supporting evidence types.
Confirmed/public warnings remain subject to the specification's verified
report and repeated-confirmed-report requirements.
