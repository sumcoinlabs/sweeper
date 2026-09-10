# Sweeper Specification Status

Updated: September 10, 2026

Legend:

- DONE = implemented and demonstrated for the stated platform/scope
- PARTIAL = foundation exists, implementation is incomplete, or broader hardware validation is still required
- TODO = not implemented
- LATER = original optional/future feature

## Overall milestone status

DONE - Milestone 1: physical iPhone validation
DONE - Milestone 2: Wi-Fi discovery and device fingerprinting
DONE - Milestone 3: BLE detection depth and shared scan UX
DONE - Milestone 4: Lens / IR Assist
NEXT - Milestone 5: GPS-only property identification
PARTIAL - Milestone 16 Android foundation: build/install/Lens runtime smoke-tested, full milestone not complete

## Core application

DONE - React Native mobile application
DONE - Shared iOS/Android React Native project tracked in the primary repository
DONE - iOS application boots and navigates
DONE - iOS 15.1 minimum deployment target
DONE - Anonymous sweep session
DONE - Guided workflow
DONE - Safe-area/Dynamic Island layout
DONE - Node/Express backend
DONE - PostgreSQL database
DONE - Self-hosted development environment
PARTIAL - Automated/unit/integration test coverage; release-grade CI remains Milestone 18

## Location

DONE - Device GPS capture
DONE - Fresh high-accuracy request
DONE - 50 m maximum-accuracy gate before sweep progression
DONE - When-In-Use permission model; no background location requirement
PARTIAL - Native reverse geocoding currently captures locality/administrative area/country
TODO - Automatic street-level property address where available
TODO - Normalized property identity
TODO - Coordinate-fallback identity when street address is unavailable
TODO - Property matching tolerance/deduplication
DONE - Manual address entry removed from the active product flow/direction

## Wi-Fi detection

DONE - Local IPv4 detection
DONE - Private subnet scanning
DONE - Native ICMP-assisted host discovery on iOS
DONE - Safe TCP connection probes
DONE - Bonjour/mDNS discovery
PARTIAL - SSDP/UPnP implemented; physical iOS multicast behavior/entitlement makes it an optional signal
DONE - HTTP service fingerprinting
DONE - RTSP protocol interrogation/confirmation
DONE - Evidence-based camera/video classification
DONE - Consumer-safe Wi-Fi caution UI
DONE - Exportable Wi-Fi evidence
DONE - Physical-iPhone execution validated
PARTIAL - Manufacturer/OUI matching because arbitrary LAN peer MAC addresses are not exposed by iOS
TODO - Consolidated updateable network/OUI intelligence dataset (Milestone 14)
TODO - Android-specific network capability validation (Milestone 16)

## Bluetooth

DONE - Milestone 3 BLE detection depth
DONE - Physical-iPhone BLE validation
DONE - Repeated advertisement/RSSI sampling
DONE - Median/average/strongest valid RSSI handling
DONE - Invalid positive RSSI sentinel filtering
DONE - Approximate proximity bands
DONE - Advertised/local names
DONE - Service UUID and service-data UUID capture
DONE - Manufacturer-data/company-ID extraction where exposed
DONE - Local camera/security vendor fingerprint matching
DONE - Known/common-device recognition to reduce false positives
DONE - Evidence-based BLE assessment
DONE - Privacy-preserving backend BLE sanitization/hashing
DONE - Consumer-safe Bluetooth caution UI
DONE - Exportable Bluetooth evidence
DONE - Guardrail that Bluetooth-only evidence cannot establish a hidden-camera threat
TODO - Android-specific BLE validation (Milestone 16)
TODO - Consolidated updateable BLE intelligence dataset (Milestone 14)

## Physical detection

DONE - Guided physical inspection
DONE - High-risk hiding-area guidance
DONE - Suspicious/clear marking
DONE - Reduced four-step UX
PARTIAL - Broader real-world usability validation across users/properties

## Camera / Lens / IR

DONE - VisionCamera integrated
DONE - Camera permission workflow
DONE - Live camera preview
DONE - Explicit front/rear selection
DONE - Evidence photo capture
DONE - On-device frame analysis
DONE - Lens-reflection candidate detection
DONE - Multiple optical candidate tracking and target-marker projection
DONE - Temporal persistence/lock memory
DONE - Passive Lens search
DONE - User-controlled steady scan light
DONE - Possible/strong warning presentation and `TARGET LOCKED` state
DONE - Alert sounds, haptics and mute control
DONE - IR-source candidate analysis path
DONE - Guided Lens/IR instructions and false-positive language
DONE - Physical-iPhone execution/validation
PARTIAL - Automated device IR-capability detection; hardware sensitivity still varies and user camera selection remains necessary
PARTIAL - Android optical path physically smoke-tested on one Samsung device; broader Android validation remains Milestone 16
KNOWN LIMITATION - Specular/reflective surfaces can produce Lens false positives

## Reporting and evidence

DONE - Scan schema
DONE - Property schema
DONE - Reports schema foundation
DONE - Photo schema
DONE - Server-side risk calculation
DONE - BLE identifier hashing/sanitization
DONE - Mobile scan submission to backend
DONE - Evidence photo upload to backend
PARTIAL - Nearby/property history API foundation exists
TODO - Persist structured Lens/IR finding state as report evidence
TODO - Full user report-classification workflow
TODO - Final verification/moderation status workflow
TODO - Independent-report correlation and verified-report system

## Community

PARTIAL - Backend property, nearby lookup, scan history and report tables/endpoints exist as foundation
TODO - Current-property history in the mobile UI
TODO - Prior scan display in the mobile UI
TODO - Property risk display before/during sweep
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

TODO - Airbnb listing URL association
TODO - VRBO listing URL association
TODO - Other booking URL normalization/storage
TODO - Third-party risk API
TODO - API keys/rate limiting

## Device intelligence

PARTIAL - Embedded network camera/security service/name hints
PARTIAL - Local BLE camera/security fingerprint database
PARTIAL - Known-normal BLE/smart-home recognition dataset
TODO - Local IEEE OUI dataset
TODO - Consolidated manufacturer database
TODO - Consolidated mDNS signature database
TODO - Consolidated SSDP signature database
TODO - Consolidated TCP fingerprint database
TODO - Consolidated BLE fingerprint database/update metadata
TODO - Update mechanism

## Hardware companion

LATER - Detector discovery
LATER - Pairing instructions
LATER - External detector workflow
LATER - Hardware findings attached to scan

## Android

PARTIAL - Initial Android build succeeds
PARTIAL - Physical Android device install/launch validated on Samsung SM-A136U / Android 13
PARTIAL - Standalone ARMv7 + ARM64 release APK build validated
PARTIAL - Android camera/Lens analysis executes on physical hardware
DONE - Android VIBRATE permission/runtime crash corrected
DONE - Android VisionCamera resizer shader packaged
DONE - Android NDK 28.2 native-runtime unification corrected Bonjour startup crash
DONE - Android optical alert sound resources packaged
TODO - Android Wi-Fi discovery physical validation
TODO - Android BLE physical validation
TODO - Android GPS/geocoder physical validation
TODO - Android evidence-photo validation
TODO - Android backend submission end-to-end validation
TODO - Android lifecycle/background behavior validation
TODO - Broader Android device/ABI matrix

## Backend / data

DONE - Express health/scan/photo/report/property endpoints
DONE - PostgreSQL persistence
DONE - Property risk aggregation foundation
DONE - Nearby-property radius lookup foundation
DONE - Property scan/report history endpoint foundation
PARTIAL - Current property key uses normalized submitted address/fallback plus coordinate bucketing; Milestone 5 must replace/refine this for robust GPS-only matching
PARTIAL - Current nearby query uses latitude/longitude math rather than PostGIS
TODO - Production migrations/versioned schema management
TODO - Production HTTPS endpoint/configuration

## Legal/privacy

PARTIAL - No device intrusion by design
DONE - Network-only evidence cannot establish hidden-camera threat
DONE - Bluetooth-only evidence cannot establish hidden-camera threat
DONE - BLE identifiers/manufacturer payloads sanitized or hashed for backend storage
PARTIAL - GPS separated from authenticated identity because anonymous mode exists
TODO - Terms/disclosures
TODO - Data-retention policy
TODO - GDPR/CCPA review
TODO - Property-owner dispute system
TODO - Law-enforcement request protocol
TODO - Pre-launch legal review

## Current milestone

**NEXT: Milestone 5 — GPS-only property identification.**

The existing location stage already obtains a fresh precise GPS fix and native locality/region data without manual address substitution. Milestone 5 should finish street-level reverse geocoding, normalized identity, coordinate fallback and repeat-scan property matching before Milestone 6 exposes prior property intelligence to the user.

See `MILESTONE_5_PLAN.md`.
