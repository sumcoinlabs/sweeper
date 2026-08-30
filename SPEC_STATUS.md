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

PARTIAL - Local IPv4 detection
PARTIAL - Private /24 scanning
DONE - Safe TCP connection probes
DONE - Camera-associated port scoring
TODO - Better host discovery
TODO - mDNS/Bonjour
TODO - SSDP/UPnP
TODO - Service fingerprinting
TODO - Manufacturer fingerprints
TODO - IEEE OUI integration where platform permits
TODO - Physical-iPhone validation

## Bluetooth

PARTIAL - BLE scanner implemented
PARTIAL - RSSI scoring
PARTIAL - Name-based camera hints
TODO - Physical-iPhone validation
TODO - Manufacturer-data fingerprints
TODO - Service-UUID fingerprints
TODO - Larger camera-device fingerprint database

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
PARTIAL - Mobile submission
PARTIAL - Evidence upload
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

NEXT: Milestone 1 - Physical iPhone validation.
