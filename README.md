# Sweeper — Hidden Camera Detection & Reporting

Sweeper is a mobile-first React Native application for guided hidden-camera detection and community reporting. It combines local-network evidence, Bluetooth evidence, guided physical inspection, on-device optical assistance, GPS-tagged reporting, and a self-hosted property/report backend.

The project is being built against the original Serious Mumbo specification dated August 16, 2026, with deliberate platform/safety corrections where the original assumptions are not technically reliable.

## Current project status

Current checkpoint: **Milestones 1 through 4 are complete. Milestone 5 is next.**

- Milestone 1: physical iPhone/native-stack validation — complete
- Milestone 2: Wi-Fi discovery and device fingerprinting — complete
- Milestone 3: BLE detection depth and scan UX — complete
- Milestone 4: Lens / IR Assist — complete, with post-closeout optical refinements physically tested
- Milestone 5: GPS-only property identification — next implementation target
- Milestone 16: Android — partial foundation only; build/install/Lens runtime smoke-tested, full Android milestone not complete

Recent checkpoint commits:

- `3aefaf0` — Complete Milestone 4 Lens and IR Assist
- `f5b8463` — Refine Milestone 4 optical detection and lock-on UX
- `263daaa` — Add Android optical scanner runtime foundation

See `ROADMAP.md` for all 18 milestones and `SPEC_STATUS.md` for feature-by-feature status.

## What works now

### Mobile

- React Native 0.87 / TypeScript shared iOS + Android codebase
- Anonymous sweep sessions
- Fresh high-accuracy GPS with a 50 m maximum-accuracy gate
- Native/system reverse-geocoding foundation with no paid geocoder
- No manual property/address substitution in the active sweep flow
- Safe local-LAN host discovery and service fingerprinting
- Native ICMP-assisted discovery on iOS
- Bonjour/mDNS discovery
- SSDP/UPnP foundation where platform entitlement/network behavior allows it
- TCP/HTTP/RTSP service probing without authentication or device-content access
- BLE scanning with repeated advertisement sampling and RSSI statistics
- Local camera/security BLE fingerprints plus known-common-device recognition
- Guided physical inspection checklist
- VisionCamera Lens / IR scanner
- Direct Lens-mode luma/Y-plane analysis on-device
- IR color/BGR analysis path
- Multi-candidate optical tracking, persistence, target marker and lock-on UI
- Possible/target-lock alert sounds, haptics and mute control
- Evidence photo capture
- Evidence-weighted sweep summary and backend submission

### Backend

- Node.js / Express API
- PostgreSQL persistence
- Properties, scans, photos and reports schema
- Anonymous scan submission
- Server-side risk scoring
- BLE identifier hashing/sanitization
- Evidence photo upload
- Nearby-property lookup foundation
- Property scan/report history endpoints
- Self-hosted development deployment through Docker Compose

## Important product rules

Sweeper is an evidence-assistance tool, not a camera-certification system.

- An unknown network/Bluetooth device is **not** treated as proof of a hidden camera.
- A reachable network-video service is evidence of network-video equipment, not evidence that it is hidden or improperly placed.
- RSSI is approximate proximity only; the app does not claim BLE direction.
- Optical Lens/IR results are clues. Reflective surfaces, LEDs, chrome, glass and other specular objects can produce false positives.
- A clean scan cannot prove that a room is camera-free.
- Public/community accusations are reserved for later moderated/verified reporting milestones.

## Deliberate changes from the original specification

1. **No universal iOS MAC/OUI promise.** iOS does not expose arbitrary LAN peer MAC addresses to normal apps. Sweeper therefore relies on host/service evidence on iOS and will use MAC/OUI only where a platform legitimately exposes it.
2. **Unknown device != camera.** Unknown Wi-Fi/BLE devices are contextual findings, not automatic threats.
3. **No paid runtime API requirement.** GPS, reverse geocoding, optical processing, networking and backend services use native/open/self-hosted components.
4. **GPS-only property direction.** The current product direction does not ask the user to type a replacement address. Milestone 5 will resolve and normalize the property automatically from GPS, with coordinate fallback.
5. **IR/lens detection is assistive.** Phone camera hardware varies in IR sensitivity and optical reflections can be caused by ordinary objects.
6. **No active intrusion.** Sweeper does not log into devices, exploit services, bypass authentication or retrieve camera feeds/content.

## Current technical baseline

- React Native `0.87.0`
- React `19.2.3`
- Node 22+
- VisionCamera `5.2.3`
- `@sfourdrinier/react-native-ble-plx` `3.9.3`
- `@react-native-community/geolocation` `3.4.0`
- native Nitro location geocoder `1.2.0`
- `react-native-sound` `0.13.0`
- Node/Express backend
- PostgreSQL 16 development database
- iOS minimum deployment target 15.1
- Android minSdk 26, compileSdk 37, targetSdk 36, NDK 28.2

The Android release smoke path currently produces a standalone ARMv7 + ARM64 APK. That does **not** mean Milestone 16 is complete; Wi-Fi, BLE, GPS/geocoder, evidence/submission and lifecycle still need Android-specific physical validation later.

## Development setup

The live React Native project is already tracked in `mobile/`. Do not recreate it with a new React Native scaffold.

From a fresh clone on the M1/M-series development Mac:

```bash
chmod +x scripts/*.sh && ./scripts/setup-m1.sh
```

The setup script validates the toolchain, installs the tracked mobile/backend dependencies, installs iOS pods when the Ruby/CocoaPods toolchain is available, and starts the local PostgreSQL service when Docker is available.

Start the development backend and Metro:

```bash
./scripts/dev.sh
```

Then launch the desired native target from Xcode/Android Studio or with the React Native CLI.

For iOS simulator:

```bash
cd mobile && npm run ios
```

For Android with an authorized device/emulator:

```bash
cd mobile && npm run android
```

Development API discovery uses the Metro host when available, so a physical development phone normally reaches the backend on the same Mac without hard-coding the Mac's LAN IP. Production still requires a real HTTPS API endpoint in `mobile/src/config.ts`.

## Repository layout

```text
sweeper/
├── README.md
├── ROADMAP.md
├── SPEC_STATUS.md
├── MILESTONE_*_*.md
├── backend/
│   ├── db/init.sql
│   └── src/
├── mobile/
│   ├── android/
│   ├── ios/
│   └── src/
├── mobile-overlay/
│   └── src/
└── scripts/
```

`mobile/` is the live application. `mobile-overlay/` mirrors the project-owned React Native source used by the bootstrap/history workflow and should remain synchronized when shared source files are changed.

## Detection status

### Wi-Fi

The validated iOS path combines private-subnet host discovery, ICMP, targeted TCP probes, Bonjour/mDNS, optional SSDP/UPnP, HTTP fingerprints and RTSP protocol interrogation. A physical iPhone repeatedly discovered and confirmed the known RTSP test target during Milestones 2 and 3.

### Bluetooth

The BLE path samples repeated advertisements, filters invalid RSSI sentinel values, records median/average/strongest RSSI, captures names/service/manufacturer metadata where exposed, and applies local camera/security and known-normal fingerprints. Strong anonymous BLE alone does not create a camera warning.

### Lens / IR

Lens mode processes the camera's luma plane directly to detect compact bright/specular returns and tracks plausible candidates over time. The UI supports passive optical searching and a user-controlled steady scan light, with orange possible findings and a stronger `TARGET LOCKED` state. IR mode keeps color evidence available for white/purple IR-source assistance.

False positives from reflective surfaces remain an expected limitation of phone-only optical detection and are intentionally disclosed to the user.

## Location and Milestone 5

The existing location foundation already:

- requests When-In-Use location permission,
- requires a fresh fix,
- rejects fixes worse than 50 m,
- records latitude/longitude/accuracy,
- performs native reverse geocoding for locality/region/country,
- prevents manual address entry from substituting for GPS.

Milestone 5 will finish street-level reverse geocoding, normalized property identity, coordinate fallback and repeat-scan property matching. See `MILESTONE_5_PLAN.md`.

## Data and mapping note

The current development backend uses PostgreSQL with latitude/longitude columns and a mathematical nearby-property query. The original specification mentioned PostGIS. PostGIS remains an available self-hosted upgrade for later property/map scale work, but it is not required for the current MVP path.

## Privacy defaults

- Anonymous sweeps are supported.
- No full MAC-address collection is required.
- BLE identifiers are hashed server-side before persistence.
- Raw manufacturer payloads are hashed rather than exposed publicly.
- Photos are stored privately by the MVP backend.
- GPS is associated with a scan/property, not a public user-location history.
- Network/Bluetooth evidence is explicitly separated from a verified hidden-camera accusation.

## Documentation

- `ROADMAP.md` — 18-milestone implementation plan and current checkpoint
- `SPEC_STATUS.md` — feature-by-feature status against the specification
- `MILESTONE_1_VALIDATION.md` — physical iPhone/native-stack validation
- `MILESTONE_2_VALIDATION.md` — final Wi-Fi/network validation
- `MILESTONE_2B_STATUS.md` / `MILESTONE_2C_TEST_PLAN.md` — Milestone 2 development history and platform constraints
- `MILESTONE_3_VALIDATION.md` — BLE and Wi-Fi regression validation
- `MILESTONE_3_TEST_PLAN.md` — archived M3 test plan/history
- `MILESTONE_4_VALIDATION.md` — Lens/IR validation plus post-closeout refinement notes
- `MILESTONE_4_TEST_PLAN.md` — archived/current optical test strategy
- `MILESTONE_5_PLAN.md` — next implementation plan

## Production gates still ahead

Before public release/community warnings, the roadmap still requires property identity/intelligence, reporting workflow, moderation/disputes, map, optional accounts, integrations/API, updateable device intelligence, Android completion, privacy/legal/security hardening and release/CI work.

No paid API is required by the current runtime architecture. Normal Apple/Google developer-program, hosting/domain and legal-review costs remain outside the runtime API-cost target.
