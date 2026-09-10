# Milestone 4 Validation — Lens & IR Assist

**Status:** Complete
**Initial physical validation date:** 2026-09-01
**Initial platform:** Physical iPhone
**Post-closeout refinement:** 2026-09-10 with physical Android smoke testing
**Milestone:** 4 — Lens / IR Assist

## Initial M4 closeout

The initial M4 build was built, installed, launched and exercised on a physical iPhone. It established the camera/optical foundation and allowed the project to proceed beyond the original coarse brightness heuristic.

Validated capabilities included:

- direct **Camera Scanner** entry from Home
- VisionCamera live preview
- explicit rear/front camera selection
- evidence photo capture
- user-controlled steady scan light
- on-device connected-component optical analysis
- temporal persistence
- IR dark-scene/color gating
- guided scan instructions and false-positive warnings
- no cloud computer-vision API

The experimental FastOpenCV dependency was removed during development after native-build incompatibility. The final detector does not depend on FastOpenCV.

## Post-closeout Lens refinement

The working optical implementation was substantially refined after the initial M4 closeout and checkpointed in `f5b8463`.

### Lens processing

Lens mode now reads VisionCamera's Y/luma plane directly instead of depending on the GPU resize path. This was selected after physical testing showed that resize-path failures could create gaps in Lens detection.

The Lens detector now includes:

- approximately six analyses per second
- adaptive scene-relative brightness thresholding
- connected-component/blob detection
- compactness/fill/aspect/circularity/contrast/size scoring
- multiple ranked candidate retention
- visible scanner-region filtering
- preview-coordinate projection
- spatial target continuity
- target memory/reacquisition
- adaptive marker smoothing
- motion/stability tracking
- possible, strong and held states

### Lens presentation

The current UI includes:

- orange possible findings
- red strong target treatment
- target marker/crosshair/brackets
- `TARGET LOCKED` wording for the strong state
- local possible and lock alert sounds
- haptic feedback
- shared sound mute control

The accepted current hold constants were shortened during physical tuning to approximately 600 ms for possible, 800 ms for initial strong, and 900 ms for steady/stable strong. Continued candidate evidence can still refresh/reacquire target memory.

### Passive versus scan-light behavior

The current implementation intentionally supports a passive Lens search as well as a user-controlled illuminated search.

Passive mode can surface lens-like/specular optical candidates. Turning on the scan light provides controlled illumination/retroreflection assistance and uses the same final `TARGET LOCKED` name for a strong state.

The earlier M4 note that Lens alerts always require the scan light is therefore superseded by this refinement.

## IR processing

IR mode retains a color/BGR analysis path because white/purple color evidence is useful for possible IR-source highlighting.

- Camera selection remains explicit rather than automatically forcing the front camera.
- Bright-room gating suppresses inappropriate IR classification.
- Phone hardware may filter IR differently between front/rear cameras.
- An IR source is not automatically represented as a camera.

## False-positive interpretation

Reflective surfaces are a known limitation of phone-only Lens detection. During current physical testing, ordinary reflective/specular surfaces could create possible or strong optical findings.

This is accepted for M4 because the product correctly treats optical output as a **lens-like reflection / inspection clue**, not proof that a hidden camera exists. Further threshold tuning should be based on reproducible target/non-target test cases so false-positive reduction does not destroy real-lens sensitivity.

## Android shared-code smoke validation

Commit `263daaa` checkpointed the Android runtime foundation required to execute the shared optical code on physical hardware.

Validated on Samsung SM-A136U / Android 13:

- Gradle build
- APK install and launch
- native startup after NDK 28.2 unification
- Lens frame analysis
- possible and strong/`TARGET LOCKED` states
- packaged possible/lock sound resources
- vibration permission
- packaged Vulkan resizer shader
- standalone ARMv7 + ARM64 release APK generation

This does **not** close Milestone 16. Android Wi-Fi, BLE, GPS/geocoder, evidence-photo, backend submission, lifecycle and broader device validation remain future Android acceptance items.

A recoverable CameraX `OperationCanceledException` was observed when torch/camera reconfiguration overlapped. The scanner continued running afterward; this remains Android polish rather than an M4 closure blocker.

## Product interpretation

A positive optical result means a lens-like/specular reflection or possible IR source. It is not proof that an object is a hidden camera, and a clean scan is not proof that a room is camera-free.

Phone hardware, viewing angle, distance, ambient light, IR filtering, reflective surfaces, LEDs and camera design can all affect results.

## Exit criteria

- [x] Physical iPhone build/install/launch
- [x] Live camera preview
- [x] Explicit camera selection
- [x] User-controlled scan light
- [x] Lens candidate analysis
- [x] IR candidate analysis path
- [x] Temporal persistence/tracking
- [x] Target marker/lock UX
- [x] Guided scanning UX
- [x] False-positive language
- [x] On-device processing
- [x] No paid/cloud CV API
- [x] Evidence photo capture
- [x] Post-closeout Android Lens smoke test
- [x] User accepted current optical behavior as sufficient to move on

**Milestone 4 remains closed. Next: Milestone 5.**
