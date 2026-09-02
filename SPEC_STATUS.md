# Sweeper Specification Status

Legend:

- DONE = implemented and demonstrated
- PARTIAL = foundation exists but incomplete or not hardware-validated
- TODO = not implemented
- LATER = original optional/future feature

## Core application

DONE - React Native mobile application
DONE - iOS application boots and navigates
DONE - iOS 15.1 minimum deployment target
DONE - Anonymous sweep session
DONE - Guided workflow
DONE - Safe-area/Dynamic Island layout
DONE - Node/Express backend
DONE - PostgreSQL database
DONE - Self-hosted development environment

## Location

DONE - GPS capture
DONE - GPS accuracy
PARTIAL - Reverse geocoding
TODO - Automatic street-level property identity
TODO - Automatic property matching
DONE - Manual address entry removed from product direction

## Wi-Fi detection

DONE - Local IPv4 detection
DONE - Private /24 scanning
DONE - Native ICMP-assisted host discovery
DONE - Safe TCP connection probes
DONE - Bonjour/mDNS discovery
PARTIAL - SSDP/UPnP (implemented; physical iOS multicast entitlement dependent)
DONE - HTTP/RTSP service fingerprinting
DONE - Evidence-based camera/video classification
PARTIAL - Manufacturer/OUI fingerprints where platform APIs permit
DONE - Consumer-safe Wi-Fi caution UI
DONE - Exportable Wi-Fi evidence
DONE - Physical-iPhone execution validated

## Bluetooth

IN PROGRESS - Milestone 3 BLE detection depth
DONE - Physical-iPhone BLE execution previously validated
IMPLEMENTED FOR TEST - Repeated RSSI sampling/proximity bands
IMPLEMENTED FOR TEST - Advertised/local names
IMPLEMENTED FOR TEST - Service UUID and service-data UUID capture
IMPLEMENTED FOR TEST - Manufacturer-data/company-ID extraction
IMPLEMENTED FOR TEST - Local camera/security vendor fingerprint database
IMPLEMENTED FOR TEST - Evidence-based BLE assessment
IMPLEMENTED FOR TEST - Privacy-preserving backend BLE sanitization
IMPLEMENTED FOR TEST - Consumer-safe Bluetooth caution UI
IMPLEMENTED FOR TEST - Exportable Bluetooth evidence
PENDING - Milestone 3 physical validation

## Physical detection

DONE - Guided physical inspection
DONE - High-risk hiding-area guidance
DONE - Suspicious/clear marking
DONE - Reduced four-step UX
TODO - Real-world UX validation

## Camera / IR

PARTIAL - VisionCamera integrated
PARTIAL - Camera permission workflow
PARTIAL - Camera preview architecture
PARTIAL - Evidence photo support
TODO - Physical-iPhone camera validation
TODO - Frame analysis
TODO - Lens-reflection candidate detection
TODO - IR-source candidate detection
TODO - Guided IR sweep
TODO - Device capability detection

## Reporting

DONE - Scan schema
DONE - Property schema
DONE - Reports schema
DONE - Photo schema
DONE - Server-side risk calculation
DONE - BLE identifier hashing
DONE - Mobile scan submission to backend
DONE - Evidence photo upload to backend
TODO - Full report classification workflow
TODO - Verified-report workflow

## Community

TODO - Current-property history
TODO - Prior scan display
TODO - Property risk display
TODO - Community warning thresholds
TODO - Nearby warning layer
TODO - Map
TODO - Property disputes
TODO - Moderation
TODO - Abuse prevention

## Accounts

DONE - Anonymous architecture
TODO - Optional authentication
TODO - User scan history
TODO - Account deletion/export

## Integrations

TODO - Airbnb listing URL
TODO - VRBO listing URL
TODO - Third-party risk API
TODO - API keys/rate limiting

## Device intelligence

TODO - Local IEEE OUI dataset
TODO - Camera manufacturer database
TODO - mDNS fingerprint database
TODO - SSDP fingerprint database
TODO - TCP fingerprint database
TODO - BLE fingerprint database
TODO - Update mechanism

## Hardware companion

LATER - Detector discovery
LATER - Pairing instructions
LATER - External detector workflow
LATER - Hardware findings attached to scan

## Android

TODO - Initial Android build
TODO - Android device testing
TODO - Android Wi-Fi discovery
TODO - Android BLE
TODO - Android camera
TODO - Android GPS/geocoder
TODO - Android submission

## Legal/privacy

PARTIAL - No device intrusion by design
PARTIAL - Device identifiers hashed
PARTIAL - GPS separated from authenticated identity
TODO - Terms/disclosures
TODO - Data-retention policy
TODO - GDPR/CCPA review
TODO - Property-owner dispute system
TODO - Law-enforcement request protocol
TODO - Pre-launch legal review

## Current milestone

COMPLETE: Milestone 2 - Wi-Fi discovery and device fingerprinting.

IN PROGRESS: Milestone 3 - BLE detection depth.
## Milestone 3 - BLE detection depth

Implemented and physically validated on iPhone:
- repeated BLE advertisement collection
- RSSI median/average/strongest sampling with invalid-sample filtering
- approximate proximity bands
- advertised name, local name, service UUID, service-data UUID and
  manufacturer/company metadata capture where iOS exposes it
- local camera/security fingerprint matching
- known ordinary/smart-home device recognition to reduce false positives
- anonymous/strong BLE signals do not become camera warnings by themselves
- evidence codes and sanitized backend storage
- exportable findings
- animated consumer-facing scan/result UX
- Bluetooth-only evidence cannot establish a hidden-camera threat


<!-- SWEEPER_M4_COMPLETE -->
## Milestone 4 — Lens / IR Assist

**Implemented and physically validated.**

The phone-only optical layer now detects lens-like bright-point returns and possible IR sources using on-device frame analysis. Results are explicitly treated as clues rather than proof of a hidden camera. No cloud CV service is used.

See `MILESTONE_4_VALIDATION.md`.

The next implementation target is **Milestone 5: automatic GPS-only property identification with no manual property/address input.**
