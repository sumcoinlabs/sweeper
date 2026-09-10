# Milestone 3 - BLE Detection Depth Test Plan

Status: COMPLETE — archived test plan and refinement history

Milestone 3 passed physical iPhone validation. See `MILESTONE_3_VALIDATION.md`.

## What Milestone 3 adds

- repeated BLE advertisement sampling instead of keeping only one RSSI value
- median, average and strongest RSSI measurements
- consumer proximity bands:
  - very close
  - nearby
  - farther away
  - unknown
- advertised name and local-name collection
- service UUID collection
- service-data UUID collection
- manufacturer-data presence and Bluetooth company-ID extraction
- local camera/security vendor name fingerprint database
- explicit camera-name detection
- proprietary-service signature generation for future intelligence updates
- evidence-based BLE assessment
- no warning from an unnamed/unknown device merely because its RSSI is strong
- privacy-preserving backend identifier hashing
- raw manufacturer payload is hashed rather than persisted
- ordinary device names are not persisted unless the device is actually
  selected for backend camera/security review
- simple consumer caution UI
- exportable Bluetooth evidence for support/backend review

## Evidence policy

Bluetooth evidence answers two separate questions:

1. Does this advertisement resemble camera/security hardware?
2. How close does the Bluetooth transmitter appear to be?

RSSI only informs question 2. A very strong anonymous signal is not camera
evidence.

No Bluetooth-only finding is eligible to establish a hidden-camera threat.
Physical placement, lens/photo evidence, corroborating network evidence, prior
verified reports, or another independent evidence type is required later in
the reporting workflow.

## Physical acceptance test

Run on the physical iPhone.

Required:

1. BLE scan completes without native/runtime errors.
2. The existing nearby BLE population is still discovered.
3. Repeated advertisements produce more than one sample for at least some
   devices.
4. Generic strong/unnamed BLE devices do not become camera cautions.
5. Normal consumer devices do not become camera cautions solely because they
   are nearby.
6. Camera/security name fingerprints, if present in the environment, produce a
   plain-language caution.
7. The default UI does not expose UUIDs, RSSI values, identifiers or raw
   manufacturer data.
8. Export Findings opens the iOS share sheet when a caution exists.
9. Structured development logs provide enough information to improve the local
   fingerprint database without disclosing raw BLE identifiers.

## Development log markers

- `[SWEEPER][BLE] starting`
- `[SWEEPER][BLE][OBSERVED]`
- `[SWEEPER][BLE] complete`

Physical validation and closeout are now complete. Final observed counts and
acceptance are recorded in `MILESTONE_3_VALIDATION.md`.

## M3 UX/intelligence refinement after first physical test

First physical test:
- 26 BLE records
- 6 named devices
- repeated advertisements confirmed
- 2 devices exposed service UUIDs
- generic strong/unnamed signals correctly produced zero camera cautions

Research-driven refinement:
- default result now leads with threat status rather than raw Bluetooth jargon
- scan progress uses a non-directional signal visualization; it does not pretend
  the iPhone knows a compass direction to a BLE device
- recognized ordinary devices are summarized for reassurance
- anonymous BLE advertisements are explicitly explained as common and not
  suspicious by themselves
- export is available even when no caution exists
- known benign/smart-home recognition added for Apple Watch, AirPods, Apple TV,
  OKIN adjustable-bed controllers, and Nest/Google FEAF/FEB0 services
- Nest service recognition does not imply a camera
- camera/security cautions still require camera-specific naming/signature
  evidence and Bluetooth alone remains ineligible to establish a hidden-camera
  threat

## Final M3 closeout pass

Physical validation before closeout showed:
- 27-28 BLE advertisers in repeated room scans
- repeated duplicate advertisements captured for RSSI sampling
- Apple Watch, AirPods, Apple TV, OKIN adjustable-bed control and Nest/Google
  member services distinguished from camera clues
- generic strong and unnamed BLE advertisers correctly produced zero
  camera/security cautions
- Wi-Fi regression continued to autonomously discover the RTSP video target

Final fixes:
- filter invalid positive RSSI sentinel samples so values such as +127 cannot
  corrupt strongest/average/proximity calculations
- extend the user BLE pass to 10 seconds
- add Samsung-TV and Google member-service recognition
- treat known smart-home service identity as context, not camera evidence
- add animated non-directional beacon scanning UI
- add evidence meters, scan-stage widgets and richer result cards
- add animated Wi-Fi scan stages without changing the validated Wi-Fi engine
- keep all direction/proximity language honest: RSSI is approximate and the
  app does not claim compass direction
