# Sweeper Development Roadmap

Sweeper is being developed against the original Serious Mumbo hidden-camera detection and reporting specification.

## Non-negotiable project rules

1. Preserve all practical features from the original specification.
2. No paid runtime APIs unless absolutely unavoidable.
3. Prefer native device APIs, open data, open-source libraries and self-hosted services.
4. Anonymous use must remain possible.
5. Never represent an unknown device as proof of a hidden camera.
6. Detection evidence and community reports must be clearly distinguished.
7. Each milestone is implemented, tested, committed and pushed before proceeding.
8. iOS minimum deployment target: 15.1.
9. Android will use the shared React Native codebase wherever possible.
10. Public/community accusations require moderation and dispute safeguards.

## Baseline

Current stack:

- React Native 0.87 / TypeScript
- iOS minimum 15.1
- Xcode 26.3 / iOS 26 SDK
- Node.js / Express backend
- PostgreSQL
- Anonymous sweep sessions
- GPS capture
- Native reverse-geocoding foundation
- Limited private-LAN TCP service scan
- BLE scanning foundation
- Four-step guided physical inspection
- VisionCamera 5 Lens Assist foundation
- Evidence photo support
- Server-side risk scoring
- Scan/property/report database
- Local/self-hosted development environment

## Milestone 1 - Physical iPhone validation

Goal: Prove the current native stack on real hardware.

Validate:

- App installation/signing
- GPS
- Native reverse geocoding
- Local-network permission
- Wi-Fi/IP discovery
- TCP probes
- Bluetooth permission
- BLE scanning
- Camera permission
- Rear/front cameras
- Evidence photo capture
- Backend access from physical phone
- Scan submission

Acceptance:

A complete sweep can be performed on a real iPhone and submitted to the local backend.

## Milestone 2 - Wi-Fi discovery and device fingerprinting

Expand beyond the current TCP port probe.

Implement:

- Local IPv4 discovery
- Host discovery
- Safe TCP service probing
- Bonjour/mDNS discovery
- SSDP/UPnP discovery
- Hostname/service-name collection
- Device fingerprint engine
- Known camera/DVR/NVR signatures
- Manufacturer classification
- Locally bundled IEEE OUI data where MAC addresses are available
- Android MAC/OUI support where platform APIs allow it
- Evidence-based confidence score
- Human-readable explanation for every flag

Do not:

- Log into devices
- Retrieve camera content
- Exploit services
- Claim that an open port proves a camera exists

## Milestone 3 - BLE detection depth

Implement and validate:

- Real-device BLE discovery
- Advertised names
- Service UUIDs
- Manufacturer data
- RSSI
- Camera/security-device fingerprints
- Known-vendor matching
- Unknown/unnamed-device handling
- Signal-strength explanation
- Local BLE fingerprint database
- Privacy-preserving identifier hashing on upload

## Milestone 4 - Lens and IR Assist

Implement:

- VisionCamera live preview
- Rear/front camera selection
- Evidence photo capture
- Exposure/contrast assistance
- Lens-reflection guidance
- Frame-processing pipeline
- Candidate bright-point detection
- Candidate IR-source highlighting where device hardware permits
- Guided room sweep
- Device capability detection
- Clear false-positive warnings

No cloud computer-vision API.

All processing stays on-device.

## Milestone 5 - GPS-only property identification

Remove manual property identification.

Implement:

- GPS capture automatically when sweep begins
- Accuracy reporting
- Native iOS reverse geocoding
- Native Android reverse geocoding
- Street-level address where available
- Normalized property identity
- Coordinate fallback
- Property matching tolerance
- No Google Maps API dependency

## Milestone 6 - Property intelligence

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

## Milestone 7 - Reporting and evidence

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

Confirmation must belong to the verification system.

## Milestone 8 - Community warning layer

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

## Milestone 9 - Map

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

## Milestone 10 - Accounts and scan history

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

## Milestone 11 - Airbnb / VRBO listing association

Implement:

- Optional listing URL
- URL normalization
- Airbnb association
- VRBO association
- Other booking URL storage
- Relationship between listing and physical property
- No scraping requirement
- No paid Airbnb/VRBO API dependency

## Milestone 12 - Third-party API

Implement:

- Read-only property risk API
- API authentication
- API keys
- Rate limiting
- Versioned endpoints
- Documentation
- Privacy filtering
- Partner integration architecture

## Milestone 13 - Verification and moderation

Implement:

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

## Milestone 14 - Device intelligence database

Create an updateable local dataset containing:

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

Provide update mechanism without requiring a paid API.

## Milestone 15 - Hardware detector integration

Original optional hardware feature.

Implement:

- Supported detector definition
- BLE detection where supported by hardware
- Pairing/setup guidance
- Guided external lens-detector workflow
- Findings attached to sweep
- Hardware evidence category

Do not require hardware for normal Sweeper operation.

## Milestone 16 - Android

Validate and complete:

- Android build
- GPS
- Native reverse geocoding
- Wi-Fi discovery
- BLE
- Camera
- Lens/IR processing
- Permissions
- Background/lifecycle behavior
- Backend communication
- Evidence photos
- Submission
- Device fingerprint capabilities unavailable on iOS where Android permits them

## Milestone 17 - Privacy, legal and security hardening

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

## Milestone 18 - Release preparation

- Unit tests
- Integration tests
- Device matrix
- iOS 15.1 through current compatibility testing
- Android compatibility matrix
- Backend migration system
- Production configuration
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
- react-native-ble-plx
- local networking
- IEEE OUI data
- self-maintained fingerprints
- Node/Express
- PostgreSQL
- MapLibre
- self-hosting

Potential unavoidable external costs:

- Apple Developer membership
- Google Play registration
- Domain/server when public deployment requires it
- Legal review


<!-- SWEEPER_M4_COMPLETE -->
## Milestone 4 closure — Lens / IR Assist

**Status: COMPLETE**

Physical-iPhone validation passed. The final M4 implementation provides a direct camera scanner, explicit camera selection, steady user-controlled Lens scan light, on-device connected-component optical analysis, temporal persistence, IR dark-scene/color gating, evidence capture, and false-positive guidance.

See `MILESTONE_4_VALIDATION.md` for validation details.

**Next: Milestone 5 — GPS-only property identification.**
