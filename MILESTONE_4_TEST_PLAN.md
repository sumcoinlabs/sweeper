# Milestone 4 — Lens / IR Assist Test Plan & Refinement History

**Status:** Complete; retained as the optical calibration/regression plan
**Initial physical closeout:** 2026-09-01 on physical iPhone
**Post-closeout refinement checkpoint:** 2026-09-10
**Related commits:** `3aefaf0`, `f5b8463`, `263daaa`

## Why the optical detector was rebuilt

The earliest implementation used a coarse JavaScript pixel-grid brightness heuristic. It produced too many high-confidence ordinary bright points and insufficient diagnostic/tracking information.

An experimental FastOpenCV path was also attempted during development but removed after native-build incompatibility. FastOpenCV is **not** part of the final M4 architecture.

## Current technical approach

The live camera session uses VisionCamera 5 and keeps React/UI state isolated from the camera host.

### Lens mode

- YUV frame output
- direct Y/luma-plane analysis rather than the GPU resizer
- approximately six analyses per second
- adaptive scene-relative brightness thresholding
- connected-component/blob extraction
- area, aspect/fill, perimeter, circularity and local-contrast scoring
- multiple ranked candidate retention
- candidate filtering to the visible scanner region
- projection of normalized analysis coordinates onto the cover-style preview
- spatial target continuity
- target memory/reacquisition
- adaptive marker smoothing and motion/stability tracking
- possible, strong and held UI states
- local audio/haptic feedback

Lens mode supports both passive optical searching and a user-controlled steady scan light. The torch is never pulsed or controlled by a detection result.

### IR mode

IR remains on the color/BGR path because white/purple color evidence matters.

- user-selected front/rear camera
- torch off when appropriate for IR observation
- bright-room suppression
- compact white/purple-source scoring
- no claim that an IR source is automatically a camera

Phone IR sensitivity varies substantially by device/camera module.

## Current lock UX

The accepted current presentation uses:

- orange possible finding
- red strong `TARGET LOCKED` state
- animated target marker/lock treatment
- possible/lock sounds
- haptics
- shared sound mute control
- short display holds intended to make the UI return toward the idle scan state quickly

Current base hold constants are approximately:

- possible: 600 ms
- initial strong: 800 ms
- steady/stable strong: 900 ms

Target memory can still reacquire/refresh when a plausible reflection remains in the scanner. The UI therefore may remain active if reflective evidence continues to be detected; this is different from a dead/stale overlay timer.

## Known limitation accepted for M4

Reflective/specular surfaces can produce Lens false positives. Examples include glass, chrome, polished fixtures, LEDs and other compact highlights.

M4 does not attempt to eliminate every reflective false positive because doing so aggressively can also suppress real lens returns. Product language must continue to describe the result as a lens-like/optical clue rather than proof of a hidden camera.

## Physical regression test

Use at least:

1. a known visible camera lens,
2. multiple non-camera reflective objects,
3. an ordinary visible LED,
4. a known IR/night-vision source in darkness when available,
5. front and rear camera in IR mode when comparing hardware sensitivity.

For Lens mode verify:

- camera session remains stable,
- passive search produces plausible candidate behavior,
- scan light stays continuously on when enabled,
- possible state appears promptly on a real target,
- strong state reads exactly `TARGET LOCKED`,
- marker/lock UI follows the target reasonably,
- alert sound/haptic/mute behavior works,
- moving away returns the UI toward idle without a long obviously stale lock,
- reflective objects are treated as possible false positives rather than proof.

For IR mode verify:

- mode does not force an unwanted camera switch,
- bright-room gating behaves sensibly,
- known IR sources can be observed on camera hardware that is IR-sensitive,
- ordinary visible lights are not represented as confirmed cameras.

## Android smoke-test result

Post-closeout shared-code testing on Samsung SM-A136U / Android 13 proved:

- Android debug build/install/launch
- VisionCamera/Lens processing
- optical possible and strong states
- local sound assets
- vibration permission
- required Vulkan resizer shader packaging
- native NDK/runtime compatibility after unifying on NDK 28.2
- standalone ARMv7 + ARM64 release APK generation

A recoverable CameraX torch operation-cancel message can appear when the torch/camera session is reconfigured quickly; the observed scanner session recovered and continued processing. This remains Android polish for Milestone 16, not an M4 blocker.

## Milestone boundary

Milestone 4 is closed. Future optical tuning should be driven by a reproducible physical failure, not by repeatedly changing the working acquisition path. Broad Android compatibility belongs to Milestone 16.
