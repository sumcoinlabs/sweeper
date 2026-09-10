# Sweeper Mobile

This directory is the live React Native 0.87 application for Sweeper.

For project status, product rules and the 18-milestone plan, start with the repository-root `README.md`, `ROADMAP.md` and `SPEC_STATUS.md`.

## Install

From `mobile/`:

```bash
npm ci
```

For iOS after native dependency changes:

```bash
cd ios && bundle install && bundle exec pod install
```

## Run

Start the backend/PostgreSQL and Metro from the repository root with:

```bash
./scripts/dev.sh
```

Then launch from Xcode/Android Studio or use:

```bash
cd mobile && npm run ios
```

or:

```bash
cd mobile && npm run android
```

## Type check

```bash
npx tsc --noEmit
```

## Current native baseline

- iOS minimum: 15.1
- Android minSdk: 26
- Android compileSdk: 37
- Android targetSdk: 36
- Android NDK: 28.2.13676358

The current Android foundation has been physically smoke-tested for build/install/Lens execution, but the full Android milestone remains later roadmap work.

## Source layout

- `src/screens/` — sweep workflow and scanner UI
- `src/services/networkScanner.ts` — Wi-Fi/LAN discovery and evidence assessment
- `src/services/bluetoothScanner.ts` / `bleFingerprints.ts` — BLE collection and local device evidence
- `src/services/lensCv.ts` — on-device Lens/IR optical analysis
- `src/services/location.ts` — GPS and native reverse-geocoding foundation
- `src/services/api.ts` — backend submission/photo upload

`../mobile-overlay/` mirrors project-owned React Native source used by the repository's bootstrap/history workflow. When shared project source changes, keep the corresponding overlay files synchronized.

## Development API

In development, `src/config.ts` derives the backend host from the Metro script URL when possible and uses port 8787. Production currently points at an intentionally invalid placeholder and must be replaced with a real HTTPS endpoint before release.

## Detection caution

Network, BLE and optical signals are evidence clues. They do not prove that a hidden camera exists. Reflective surfaces are a known source of Lens-mode false positives.
