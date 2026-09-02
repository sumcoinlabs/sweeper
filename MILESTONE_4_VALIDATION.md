# Milestone 4 Validation — Lens & IR Assist

**Status:** Complete  
**Physical validation date:** 2026-09-01  
**Platform:** Physical iPhone  
**Milestone:** 4 — Lens / IR Assist

## Implemented

- Direct **Camera Scanner** entry from Home without requiring Wi-Fi, BLE, GPS, or checklist completion.
- VisionCamera live preview.
- Explicit rear/front camera selection; the app does not automatically switch cameras when entering IR mode.
- Evidence photo capture.
- User-controlled steady scan light for Lens mode.
- Lens detection does not control or pulse the flashlight.
- On-device frame analysis with VisionCamera GPU resizing and a worklet connected-component detector.
- Adaptive scene-relative brightness thresholding.
- Compact bright-point/blob detection.
- Bounding-box, fill, aspect-ratio, perimeter, circularity, contrast, size, and color scoring.
- Temporal persistence tracking before a candidate becomes visible or strong.
- Lens-mode gating that requires the scan light before issuing a lens alert.
- IR-mode dark-scene gating and purple/white source evidence.
- Guided scan instructions and false-positive warnings.
- No cloud computer-vision API.
- All optical processing remains on-device.

## Physical validation

The Milestone 4 build was built, installed, launched, and exercised on a physical iPhone.

Observed behavior accepted for Milestone 4 closure:

- Camera Scanner launches and continuously processes live frames.
- Lens mode remains on the explicitly selected camera.
- IR mode does not automatically switch to the front camera.
- Scan light is user-controlled and remains steady when enabled.
- Detector produces live optical candidates and persistence tracking.
- Lens and IR modes both execute on the physical device.
- Calibration was tightened after physical testing to reject the dominant tiny one-cell bright-point false positives, require stronger persistence, gate Lens alerts behind the scan light, and suppress IR classification in overly bright scenes.
- The user approved the current physical behavior as sufficient to close Milestone 4 and proceed to Milestone 5.

## Product interpretation

A positive optical result means **lens-like reflection** or **possible IR source**. It is not proof that an object is a hidden camera, and a clean scan is not proof that a room is camera-free.

Phone hardware, viewing angle, distance, ambient light, IR filtering, reflective surfaces, and camera design can all affect results.

## Architecture decision

The experimental FastOpenCV dependency was removed after native-build incompatibility during M4 development. The final detector uses VisionCamera, GPU frame resizing, worklets, and an in-app connected-component/blob-analysis implementation. This preserves on-device optical analysis without a paid service or cloud CV dependency.

The BLE dependency was also moved from the legacy package to the maintained `@sfourdrinier/react-native-ble-plx` package for compatibility with the current React Native/Xcode toolchain.

## Exit criteria

- [x] Physical iPhone build/install/launch
- [x] Live camera preview
- [x] Explicit camera selection
- [x] Stable user-controlled scan light
- [x] Lens candidate analysis
- [x] IR candidate analysis
- [x] Temporal persistence
- [x] Guided scanning UX
- [x] False-positive language
- [x] On-device processing
- [x] No paid/cloud CV API
- [x] User physical validation accepted

**Milestone 4 is closed.**
