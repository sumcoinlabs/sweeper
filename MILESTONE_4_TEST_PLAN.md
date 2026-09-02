# Milestone 4 - Optical Detector Rebuild

Status: PHYSICAL CALIBRATION REQUIRED - DO NOT COMMIT YET

## Why Milestone 4 was restarted

The initial implementation used a coarse JavaScript pixel-grid brightness
heuristic. It produced high confidence from ordinary bright points, generated
too little useful diagnostic data, and camera-session churn made the torch
experience unstable.

This rebuild replaces that detector rather than tuning it.

## Technical approach

The live iPhone camera session remains in VisionCamera, but analysis now uses:

- VisionCamera V5 YUV Frame Output
- GPU-accelerated VisionCamera Resizer
- React Native Fast OpenCV v1
- 240x320 BGR analysis frames at approximately 5 analyses/second
- adaptive brightness threshold relative to scene brightness
- OpenCV contour extraction
- contour-area filtering
- bounding-box size filtering
- aspect-ratio filtering
- contour circularity
- bounding-box fill/compactness
- local peak brightness
- lens-neutrality / IR purple-white color evidence
- temporal tracking across multiple frames

React state changes no longer own the camera session. The Camera host is
memoized and isolated from moving detection overlays.

## Lens mode

- Camera is always rear when Lens mode is explicitly selected.
- Scan light is OFF initially.
- User turns the scan light on once.
- The torch remains steady until the user turns it off or leaves Lens mode.
- No detection result toggles the torch.
- Candidate must remain compact in roughly the same position over several
  analyzed frames before the overlay alerts.
- Strong alert requires additional persistence and shape quality.

## IR mode

- Switching to IR turns the torch off.
- Camera does not change automatically.
- User can explicitly try the front camera if the rear camera is not IR
  sensitive enough.
- Bright-room gating suppresses IR alerts until the room is dark enough.
- Candidate scoring favors compact white/purple sources in a dark scene.
- IR sources are not automatically called cameras.

## Physical acceptance

Test against:
1. a known visible camera lens,
2. at least two non-camera shiny objects,
3. a known active IR night-vision illuminator in darkness,
4. an ordinary visible LED,
5. optionally a TV remote for IR sensor sensitivity.

For lens mode, record whether:
- torch stays continuously on,
- candidate appears on the real lens,
- candidate survives moving closer/changing angle,
- shiny objects generate transient or stable false positives.

For IR mode, record:
- rear-camera result,
- front-camera result if tested,
- whether night-vision LEDs appear,
- whether ordinary LEDs create alerts.

Do not commit until these physical results are used to tune thresholds.
