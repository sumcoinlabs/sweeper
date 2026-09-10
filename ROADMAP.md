# Sweeper Development Roadmap

Sweeper is being developed against the original Serious Mumbo hidden-camera detection and reporting specification dated August 16, 2026.

## Current checkpoint — September 10, 2026

The project is on track with the sequential milestone plan.

- **Milestone 1 — COMPLETE**: physical iPhone/native-stack validation (`7affc9c`)
- **Milestone 2 — COMPLETE**: Wi-Fi discovery/device fingerprinting (`f2a0f18`)
- **Milestone 3 — COMPLETE**: BLE detection depth and shared scan UX (`6759e45`)
- **Milestone 4 — COMPLETE**: Lens / IR Assist (`3aefaf0`)
- **Milestone 4 refinement — CHECKPOINTED**: optical tracking/lock UX (`f5b8463`)
- **Android foundation — CHECKPOINTED**: physical build/install/Lens runtime smoke (`263daaa`)
- **Milestone 5 — NEXT**: GPS-only property identification
- **Milestone 16 — PARTIAL FOUNDATION ONLY**: Android smoke work does not close the later full Android milestone

The latest completed work intentionally stops short of claiming that reflective optical returns prove a hidden camera. Reflective surfaces remain a known source of Lens-mode false positives.

## Non-negotiable project rules

1. Preserve all practical features from the original specification.
2. No paid runtime APIs unless absolutely unavoidable.
3. Prefer native device APIs, open data, open-source libraries and self-hosted services.
4. Anonymous use must remain possible.
5. Never represent an unknown device as proof of a hidden camera.
6. Detection evidence and community reports must be clearly distinguished.
7. Each milestone is implemented, physically tested where applicable, documented, committed and pushed before proceeding.
8. iOS minimum deployment target: 15.1.
9. Android uses the shared React Native codebase wherever practical.
10. Public/community accusations require moderation, verification and dispute safeguards.
11. Phone-only optical findings are clues, not proof; specular/reflective false positives must remain visible in product language.
12. GPS property identity must not depend on manual user-entered replacement addresses.

## Current technical baseline

- React Native 0.87 / TypeScript
- iOS minimum 15.1
- Xcode 26.3 used for current physical iPhone work
- Android minSdk 26 / compileSdk 37 / targetSdk 36 / NDK 28.2
- Node.js / Express backend
- PostgreSQL development database
- Anonymous sweep sessions
- fresh GPS capture with 50 m accuracy gate
- native reverse-geocoding foundation
- private-LAN ICMP/TCP/Bonjour/SSDP discovery stack
- HTTP/RTSP service fingerprinting
- evidence-based Wi-Fi camera/video classification
- repeated BLE advertisement sampling and local fingerprints
- known-normal BLE recognition and privacy-preserving upload handling
- guided physical inspection
- VisionCamera Lens / IR scanner
- direct Lens Y/luma-plane analysis and IR color-analysis path
- multi-candidate optical tracking, persistence and target-lock UX
- local possible/lock sounds, haptics and mute control
- evidence photo support
- server-side risk scoring
- scan/property/report/photo database foundation
- nearby-property/history API foundation
- local/self-hosted development environment

## Milestone 1 - Physical iPhone validation — COMPLETE

Goal: Prove the current native stack on real hardware.

Validated:

- App installation/signing
- GPS
- Native reverse geocoding foundation
- Local-network permission
- Wi-Fi/IP discovery
- TCP probes
- Bluetooth permission
- BLE scanning
- Camera permission
- Rear camera
- Evidence photo capture
- Backend access from physical phone
- Scan submission

Acceptance result:

A complete sweep was performed on a real iPhone and submitted to the local backend. See `MILESTONE_1_VALIDATION.md`.

## Milestone 2 - Wi-Fi discovery and device fingerprinting — COMPLETE

Implemented:

- Local IPv4 discovery
- Host discovery
- Native ICMP-assisted discovery
- Safe TCP service probing
- Bonjour/mDNS discovery
- SSDP/UPnP foundation
- Hostname/service-name collection where available
- HTTP/RTSP fingerprint engine
- Known camera/DVR/NVR service/name hints
- Evidence-based confidence/assessment
- Human-readable explanation for flags
- Exportable technical evidence

Platform/deferred note:

- iOS does not expose arbitrary LAN peer MAC addresses, so OUI/manufacturer-by-MAC is not a universal iOS capability.
- Android MAC/OUI capability and a consolidated updateable OUI/device dataset remain later Milestone 14/16 work.
- SSDP/UPnP is implemented but cannot be a mandatory iOS signal because multicast availability/entitlement can vary.

Do not:

- Log into devices
- Retrieve camera content
- Exploit services
- Claim that an open port or live host proves a hidden camera exists

See `MILESTONE_2_VALIDATION.md`.

## Milestone 3 - BLE detection depth — COMPLETE

Implemented and physically validated:

- Real-device BLE discovery
- Repeated advertisement collection
- Advertised/local names
- Service UUIDs and service-data UUIDs
- Manufacturer data/company IDs where exposed
- Median/average/strongest valid RSSI
- Invalid positive RSSI sentinel filtering
- Approximate proximity bands
- Camera/security-device fingerprints
- Known/common-device recognition
- Unknown/unnamed-device handling
- Local BLE fingerprint database
- Privacy-preserving identifier hashing/sanitization on upload
- Consumer-safe scan/result UX and export

Bluetooth-only evidence cannot establish a hidden-camera threat.

See `MILESTONE_3_VALIDATION.md`.

## Milestone 4 - Lens and IR Assist — COMPLETE

Implemented and physically validated:

- VisionCamera live preview
- Explicit rear/front camera selection
- Evidence photo capture
- User-controlled steady scan light
- Lens-reflection guidance
- On-device frame-processing pipeline
- Connected-component bright-point/candidate detection
- Multiple candidate retention and spatial tracking
- Preview-coordinate projection for target markers
- Temporal persistence and lock memory
- Passive Lens search plus illuminated scan-light mode
- Strong `TARGET LOCKED` presentation
- Alert sounds, haptics and mute control
- Candidate IR-source assistance where device hardware permits
- Guided room sweep
- Clear false-positive warnings
- No cloud computer-vision API

Current implementation detail:

- Lens mode reads the camera Y/luma plane directly for reliability/performance.
- IR mode retains the color/BGR processing path because purple/white source evidence matters.
- Reflective/specular surfaces can create false positives and remain known calibration debt, not a hidden-camera determination.

Post-closeout physical Android smoke testing also proved that the shared Lens path can build, install and execute on the current Samsung test device. This is useful Milestone 16 foundation but does not close Android.

See `MILESTONE_4_VALIDATION.md`.

## Milestone 5 - GPS-only property identification — NEXT

Goal: remove manual property identification and produce a repeatable property identity from device location.

Implement:

- GPS capture automatically when sweep begins/enters location stage
- fresh-location requirement
- accuracy reporting and <=50 m gate
- native iOS reverse geocoding
- native Android reverse geocoding
- street-level address where available
- normalized address/property identity
- coordinate fallback when no street address is returned
- explicit property-matching tolerance
- backend property-key/matching update so repeat sweeps converge on the same property
- non-editable confirmation/display UI rather than manual address replacement
- no Google Maps API dependency

Existing foundation already includes high-accuracy GPS, When-In-Use permissions, native reverse geocoding for locality/region/country, property storage and a nearby-property API.

See `MILESTONE_5_PLAN.md`.

## Milestone 6 - Property intelligence — PLANNED

On arrival/current GPS:

- Search existing Sweeper property database
- Nearby/property-match endpoint
- Prior scan count
- Previous risk scores
- Prior suspected reports
- Prior verified reports
- Last scan date
- Community status

Display this before or during the sweep without prejudicing the user's own findings.

Geospatial note: the current PostgreSQL backend uses latitude/longitude plus a mathematical radius query. PostGIS remains a self-hosted option when property/map scale warrants it.

## Milestone 7 - Reporting and evidence — PLANNED

Complete:

- Sweep summary
- Network findings
- BLE findings
- Physical findings
- Lens/IR findings
- Photos
- Notes
- User classification
- No indicators
- Suspicious
- Evidence supporting suspected camera
- Upload
- Timestamp
- GPS
- Property identity
- Server-side scoring

Avoid a simple user-controlled "confirmed camera" flag.

Confirmation belongs to the later verification system.

## Milestone 8 - Community warning layer — PLANNED

Implement:

- Aggregate property risk
- Number of independent reports
- Repeat findings
- Community warnings
- Threshold rules
- Public-safe wording
- Nearby warning lookup
- Suppression of personally identifying device data
- False-positive safeguards

## Milestone 9 - Map — PLANNED

Implement:

- Nearby flagged properties
- Risk markers
- Current location
- Property details
- Prior report summaries
- MapLibre-based client
- Open/self-hosted mapping strategy
- No Google Maps dependency

Public tile infrastructure must respect provider usage policies.

## Milestone 10 - Accounts and scan history — PLANNED

Anonymous use remains default.

Optional account features:

- Registration/login
- Secure password hashing or passkeys
- Session management
- Scan history
- Saved evidence
- Account deletion
- Data export
- Privacy controls

No Firebase/Auth0 requirement.

## Milestone 11 - Airbnb / VRBO listing association — PLANNED

Implement:

- Optional listing URL
- URL normalization
- Airbnb association
- VRBO association
- Other booking URL storage
- Relationship between listing and physical property
- No scraping requirement
- No paid Airbnb/VRBO API dependency

## Milestone 12 - Third-party API — PLANNED

Implement:

- Read-only property risk API
- API authentication
- API keys
- Rate limiting
- Versioned endpoints
- Documentation
- Privacy filtering
- Partner integration architecture

## Milestone 13 - Verification and moderation — PLANNED

Implement statuses:

- suspected
- under_review
- verified
- rejected
- duplicate
- disputed

Add:

- Evidence review
- Independent-report correlation
- Moderator workflow
- Property-owner dispute process
- Correction/removal process
- Audit history
- Abuse/report-spam controls

The current backend `reports` foundation uses `confirmed` as an early internal status. Before public community launch, this must be reconciled with the roadmap's final `verified` terminology and workflow.

## Milestone 14 - Device intelligence database — PLANNED / PARTIAL FOUNDATION

Current foundation already contains embedded network camera/service hints and a local BLE fingerprint/known-normal dataset.

Still implement a consolidated updateable dataset containing:

- Manufacturer
- IEEE OUI prefixes
- mDNS signatures
- SSDP signatures
- Hostname patterns
- TCP service fingerprints
- BLE advertised-name patterns
- BLE service UUIDs
- Known camera/DVR/NVR manufacturers
- Confidence weights
- Source/update metadata

Provide an update mechanism without requiring a paid API.

## Milestone 15 - Hardware detector integration — OPTIONAL / PLANNED

Original optional hardware feature.

Implement:

- Supported detector definition
- BLE detection where supported by hardware
- Pairing/setup guidance
- Guided external lens-detector workflow
- Findings attached to sweep
- Hardware evidence category

Do not require hardware for normal Sweeper operation.

## Milestone 16 - Android — PARTIAL FOUNDATION

Already demonstrated on the current physical Samsung test device:

- Android project builds
- debug APK installs/launches
- standalone release APK builds
- Lens camera pipeline executes
- optical possible/strong states execute
- alert sound assets load
- vibration permission works
- Vulkan resizer shader is packaged
- NDK/runtime compatibility issue that crashed Bonjour was corrected

Still validate/complete as one explicit Android milestone:

- GPS
- Native reverse geocoding
- Wi-Fi discovery
- BLE
- Camera/Lens/IR across more devices
- Permissions
- Evidence photos
- Backend communication/submission
- Background/lifecycle behavior
- Device fingerprint capabilities unavailable on iOS where Android permits them
- 64-bit/release/device matrix expectations

Do not mark Milestone 16 complete based on the current smoke test alone.

## Milestone 17 - Privacy, legal and security hardening — PLANNED

Before public community launch:

- Terms/disclosure for network scanning
- No intrusion policy
- GPS privacy
- MAC/device identifier hashing
- Account privacy
- Data retention
- GDPR/CCPA considerations
- Property-owner dispute process
- Report moderation
- Abuse prevention
- Law-enforcement request policy
- Security review
- Attorney review before public community-reporting launch

## Milestone 18 - Release preparation — PLANNED

- Unit tests
- Integration tests
- Device matrix
- iOS 15.1 through current compatibility testing
- Android compatibility matrix
- Backend migration system
- Production HTTPS configuration
- Error logging without privacy leaks
- CI
- Release builds
- App icons/assets
- Privacy disclosures
- App Store preparation
- Play Store preparation

## Cost policy

Target runtime API cost: $0.

Preferred:

- Native GPS
- Native geocoding
- React Native
- VisionCamera
- `@sfourdrinier/react-native-ble-plx`
- Local networking
- IEEE OUI/open device data where legitimately available
- Self-maintained fingerprints
- Node/Express
- PostgreSQL / optional PostGIS
- MapLibre
- Self-hosting

Potential unavoidable external costs:

- Apple Developer membership
- Google Play registration
- Domain/server when public deployment requires it
- Legal review
