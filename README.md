# Sweeper MVP — SumcoinLabs

Zero-paid-API React Native MVP based on the supplied Sweeper specification.

## What this build includes

- React Native 0.87 mobile app for iOS + Android
- GPS capture using the device location provider
- Native/system reverse-geocoding for locality/region with **no paid geocoding API**
- User-confirmed property name/address (important because system geocoders do not always return an exact hotel/rental address)
- Safe local-LAN discovery on the user's current private IPv4 subnet
- TCP service probing only (no login attempts, exploitation, packet injection, or camera-content access)
- BLE scanning with rough RSSI signal strength
- Guided physical inspection checklist
- Camera/lens assist with evidence photo capture
- Evidence-weighted risk score
- Anonymous scan submission
- Node/Express backend
- PostgreSQL database
- Local photo storage
- Nearby/property-report API groundwork
- Docker Compose backend/database setup

## Deliberate changes from the original spec

1. **No MAC/OUI promise on iOS.** The app does not claim it can retrieve every LAN client's MAC address. It uses reachable-host/service evidence instead.
2. **Unknown device != camera.** The UI says suspicious/unknown and explains the evidence.
3. **IR mode is assistive.** It does not claim a bright point is proof of a hidden camera.
4. **No Google Maps API.** Location uses GPS + native system reverse-geocoding. Exact property identity is confirmed by the user.
5. **No paid cloud dependency.** The backend can run on a Mac, home/server Linux host, or an existing SumcoinLabs server.

## Current dependency baseline (August 2026)

The bootstrap pins React Native 0.87.0 and installs current native packages used by the MVP. React Native 0.87 requires Node.js 22.13+.

## M1 Mac prerequisites

- macOS with Xcode installed
- Xcode command-line tools
- Homebrew
- Node 22+
- Watchman
- CocoaPods/Bundler toolchain
- Docker Desktop or OrbStack for the local PostgreSQL backend (optional if you already run PostgreSQL)

## One copy/paste setup

From the extracted repository root:

```bash
chmod +x scripts/*.sh && ./scripts/setup-m1.sh
```

That script:

1. checks/install-hints for the M1 development prerequisites,
2. creates a fresh React Native 0.87 project in `mobile/`,
3. installs the MVP native dependencies,
4. overlays the Sweeper source code,
5. patches the iOS/Android permissions,
6. installs iOS pods,
7. starts the local PostgreSQL container and initializes the schema,
8. installs backend dependencies.

After setup, run:

```bash
./scripts/dev.sh
```

Then, in another terminal:

```bash
cd mobile && npm run ios
```

For a physical iPhone, set the backend URL in `mobile/src/config.ts` to the M1 Mac's LAN IP, for example:

```ts
export const API_BASE_URL = 'http://192.168.1.42:8787';
```

Find the Mac's Wi-Fi address with:

```bash
ipconfig getifaddr en0
```

## Repository layout

```text
sweeper-sumcoinlabs-mvp/
├── README.md
├── docker-compose.yml
├── backend/
│   ├── package.json
│   ├── db/init.sql
│   └── src/
│       ├── server.js
│       └── risk.js
├── mobile-overlay/
│   ├── App.tsx
│   └── src/
│       ├── config.ts
│       ├── types/
│       ├── utils/
│       ├── services/
│       ├── components/
│       └── screens/
└── scripts/
    ├── setup-m1.sh
    ├── patch-native.sh
    └── dev.sh
```

## LAN scanner behavior

The scanner only operates if the phone has a private IPv4 address in RFC1918 space. It derives the current `/24` and tests a limited set of common device/web/camera service ports:

- 80 / 443 — HTTP(S) device administration
- 554 / 8554 — RTSP
- 8000 / 8080 / 8899 — common embedded device services
- 37777 / 34567 — commonly seen DVR/NVR/IP-camera service ports

A reachable RTSP/DVR-type service raises suspicion. A plain web port alone contributes very little.

## Privacy defaults

- No MAC-address collection is required.
- BLE identifiers are hashed server-side before persistence.
- Photos are stored privately on the backend and are not publicly served by this MVP.
- GPS is associated with the scan/property; there is no public user-location history.
- Anonymous scans are supported.

## Production notes

This is an MVP/beta codebase, not a claim that hidden-camera detection can be guaranteed. Before App Store release, the next hardening pass should include:

- physical-device testing across multiple iPhone/Android models,
- App Store privacy labels and terms,
- HTTPS production endpoint,
- rate limiting and abuse controls,
- report moderation/dispute workflow,
- stronger property de-duplication,
- signed user accounts if community history is enabled,
- legal review of public property accusations.

No paid API is required by the runtime architecture. Public iOS distribution still requires Apple's normal developer-program membership, which is separate from API/runtime cost.
