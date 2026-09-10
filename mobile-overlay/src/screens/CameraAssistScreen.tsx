import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import Sound from 'react-native-sound';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {
  useResizer,
  type GPUFrame,
} from 'react-native-vision-camera-resizer';
import {scheduleOnRN} from 'react-native-worklets';
import {
  PrimaryButton,
  SecondaryButton,
  palette,
} from '../components/ui';
import {
  analyzeOpticalBgr,
  analyzeOpticalLumaPlane,
  type OpticalCandidate,
  type OpticalFrameAnalysis,
  type OpticalMode,
} from '../services/lensCv';
import type {EvidencePhoto} from '../types';

const ANALYSIS_WIDTH = 180;
const ANALYSIS_HEIGHT = 240;
const FRAME_TARGET_WIDTH = 360;
const FRAME_TARGET_HEIGHT = 480;
const SCAN_SIZE = 292;
const POSSIBLE_HOLD_MS = 600;
const STRONG_HOLD_MS = 800;
const STEADY_STRONG_HOLD_MS = 900;
const STABLE_STRONG_HOLD_MS = 900;
const LOCK_MEMORY_MAX_MS = 5200;
const LOCK_DIVERGENCE_FRAMES = 3;
const POSSIBLE_SOUND_COOLDOWN_MS = 1800;
const STRONG_SOUND_COOLDOWN_MS = 2400;

type StableOpticalState = {
  candidate: OpticalCandidate | null;
  streak: number;
  averageScore: number;
  visible: boolean;
  strong: boolean;
  held: boolean;
  ambient: number;
  sourceWidth: number;
  sourceHeight: number;
  tooBrightForIr: boolean;
};

type HeldOpticalState = StableOpticalState & {
  holdUntil: number;
};

type LockMotionState = {
  x: number | null;
  y: number | null;
  emaMovement: number;
  stableFrames: number;
};

type LockedTargetMemory = {
  candidate: OpticalCandidate;
  streak: number;
  averageScore: number;
  ambient: number;
  contours: number;
  poolSize: number;
  rawCandidates: number;
  sourceWidth: number;
  sourceHeight: number;
  tooBrightForIr: boolean;
  updatedAt: number;
  divergenceFrames: number;
  missFrames: number;
};

type CameraHostHandle = {
  capture: () => Promise<string>;
};

type CameraHostProps = {
  mode: OpticalMode;
  position: 'front' | 'back';
  torchOn: boolean;
  onAnalysis: (analysis: OpticalFrameAnalysis) => void;
  onPipelineIssue: (message: string) => void;
};

const CameraHost = memo(
  forwardRef<CameraHostHandle, CameraHostProps>(
    function CameraHost(
      {
        mode,
        position,
        torchOn,
        onAnalysis,
        onPipelineIssue,
      },
      ref,
    ) {
      const device = useCameraDevice(position);

      const photoOutput = usePhotoOutput({
        qualityPrioritization: 'balanced',
        quality: 0.9,
      });

      const {resizer, error: resizerError} = useResizer({
        width: ANALYSIS_WIDTH,
        height: ANALYSIS_HEIGHT,
        channelOrder: 'bgr',
        dataType: 'uint8',
        pixelLayout: 'interleaved',
        scaleMode: 'cover',
      });

      useEffect(() => {
        if (resizerError) {
          console.log(
            `[SWEEPER][OPTICAL][RESIZER_ERROR] ${String(
              resizerError,
            )}`,
          );
        }
      }, [resizerError]);

      const stableOnFrame = useCallback(
        (frame: any) => {
          'worklet';

          try {
            const runtime = globalThis as unknown as {
              __sweeperOpticalLastMs?: number;
              __sweeperOpticalLastPipelineIssueMs?: number;
            };

            const now = Date.now();
            const last = runtime.__sweeperOpticalLastMs || 0;

            // Lens V4: six analyses per second gives a sub-second warning
            // while direct Y-plane analysis remains lightweight.
            if (now - last < 160) {
              return;
            }

            runtime.__sweeperOpticalLastMs = now;

            if (mode === 'lens') {
              const planes = frame.getPlanes();

              if (planes.length === 0) {
                return;
              }

              const yPlane = planes[0];
              const pixels = new Uint8Array(
                yPlane.getPixelBuffer(),
              );

              const analysis = analyzeOpticalLumaPlane(
                pixels,
                yPlane.width,
                yPlane.height,
                yPlane.bytesPerRow,
              );

              scheduleOnRN(onAnalysis, analysis);
              return;
            }

            if (resizer == null) {
              return;
            }

            // IR still uses BGR because purple/white color evidence matters.
            // Catch Metal failures so one bad GPU frame never tears down the
            // scanner or throws a red developer overlay.
            try {
              const resized = resizer.resize(frame) as GPUFrame;

              try {
                const pixels = new Uint8Array(
                  resized.getPixelBuffer(),
                );

                const analysis = analyzeOpticalBgr(
                  pixels,
                  ANALYSIS_WIDTH,
                  ANALYSIS_HEIGHT,
                  mode,
                );

                scheduleOnRN(onAnalysis, analysis);
              } finally {
                resized.dispose();
              }
            } catch (error) {
              const lastIssue =
                runtime.__sweeperOpticalLastPipelineIssueMs || 0;

              if (now - lastIssue > 3000) {
                runtime.__sweeperOpticalLastPipelineIssueMs = now;
                scheduleOnRN(
                  onPipelineIssue,
                  `IR resize frame skipped: ${String(error)}`,
                );
              }
            }
          } finally {
            frame.dispose();
          }

        },
        [mode, onAnalysis, onPipelineIssue, resizer],
      );

      const frameOutput = useFrameOutput({
        pixelFormat: 'yuv',
        targetResolution: {
          width: FRAME_TARGET_WIDTH,
          height: FRAME_TARGET_HEIGHT,
        },
        // Lens mode reads the Y plane directly. Rotating this small analysis
        // output makes detector coordinates line up with the upright preview.
        enablePhysicalBufferRotation: true,
        dropFramesWhileBusy: true,
        allowDeferredStart: true,
        onFrame: stableOnFrame,
        onFrameDropped(reason) {
          onPipelineIssue(`frame-dropped:${reason}`);
        },
      });

      const outputs = useMemo(
        () => [photoOutput, frameOutput],
        [photoOutput, frameOutput],
      );

      useImperativeHandle(
        ref,
        () => ({
          capture: async () => {
            const result =
              await photoOutput.capturePhotoToFile(
                {flashMode: 'off'},
                {},
              );
            return result.filePath;
          },
        }),
        [photoOutput],
      );

      if (!device) {
        return null;
      }

      return (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          outputs={outputs}
          torchMode={position === 'back' && torchOn ? 'on' : undefined}
          onError={error => {
            const message =
              error instanceof Error
                ? error.message
                : String(error);

            console.log(
              `[SWEEPER][OPTICAL][CAMERA_ERROR] ${message}`,
            );
          }}
        />
      );
    },
  ),
);

function emptyStable(): StableOpticalState {
  return {
    candidate: null,
    streak: 0,
    averageScore: 0,
    visible: false,
    strong: false,
    held: false,
    ambient: 0,
    sourceWidth: FRAME_TARGET_WIDTH,
    sourceHeight: FRAME_TARGET_HEIGHT,
    tooBrightForIr: false,
  };
}

function distance(
  a: OpticalCandidate,
  b: OpticalCandidate,
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CameraAssistScreen({
  onPhoto,
  onDone,
}: {
  onPhoto: (photo: EvidencePhoto) => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {
    width: viewportWidth,
    height: viewportHeight,
  } = useWindowDimensions();
  const {hasPermission, requestPermission} =
    useCameraPermission();

  const cameraRef = useRef<CameraHostHandle>(null);
  const trackerRef = useRef<StableOpticalState>(
    emptyStable(),
  );
  const lastLogRef = useRef(0);
  const lastHapticRef = useRef(0);
  const lastAlertLevelRef = useRef<'none' | 'possible' | 'strong'>(
    'none',
  );
  const holdRef = useRef<HeldOpticalState | null>(null);
  const lockMotionRef = useRef<LockMotionState>({
    x: null,
    y: null,
    emaMovement: 1,
    stableFrames: 0,
  });
  const lockedTargetRef = useRef<LockedTargetMemory | null>(null);
  const possibleSoundRef = useRef<Sound | null>(null);
  const strongSoundRef = useRef<Sound | null>(null);
  const lastPossibleSoundRef = useRef(0);
  const lastStrongSoundRef = useRef(0);

  const [mode, setMode] =
    useState<OpticalMode>('lens');
  const [position, setPosition] =
    useState<'front' | 'back'>('back');
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const torchOnRef = useRef(torchOn);
  const soundEnabledRef = useRef(soundEnabled);
  torchOnRef.current = torchOn;
  soundEnabledRef.current = soundEnabled;
  const [state, setState] =
    useState<StableOpticalState>(emptyStable());
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState('');

  const projectCandidate = useCallback(
    (
      candidate: OpticalCandidate,
      sourceWidth: number,
      sourceHeight: number,
    ) => {
      const safeWidth = Math.max(1, sourceWidth);
      const safeHeight = Math.max(1, sourceHeight);

      // Camera preview uses cover-style rendering. Recreate that transform so
      // a detector point can be drawn where it actually appears on screen.
      const scale = Math.max(
        viewportWidth / safeWidth,
        viewportHeight / safeHeight,
      );

      const renderedWidth = safeWidth * scale;
      const renderedHeight = safeHeight * scale;
      const offsetX = (viewportWidth - renderedWidth) / 2;
      const offsetY = (viewportHeight - renderedHeight) / 2;

      return {
        x: offsetX + candidate.x * renderedWidth,
        y: offsetY + candidate.y * renderedHeight,
      };
    },
    [viewportHeight, viewportWidth],
  );

  const candidateIsInsideScanner = useCallback(
    (
      candidate: OpticalCandidate,
      sourceWidth: number,
      sourceHeight: number,
    ) => {
      const point = projectCandidate(
        candidate,
        sourceWidth,
        sourceHeight,
      );
      const dx = point.x - viewportWidth / 2;
      const dy = point.y - viewportHeight * 0.43;
      const radius = SCAN_SIZE * 0.49;

      return dx * dx + dy * dy <= radius * radius;
    },
    [
      projectCandidate,
      viewportHeight,
      viewportWidth,
    ],
  );

  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Sound.setCategory('Ambient', true);

    const possible = new Sound(
      'sweeper_possible.wav',
      Sound.MAIN_BUNDLE,
      error => {
        if (error) {
          console.log(
            `[SWEEPER][OPTICAL][SOUND_ERROR] possible ${error.message}`,
          );
        }
      },
    );

    const strong = new Sound(
      'sweeper_lock.wav',
      Sound.MAIN_BUNDLE,
      error => {
        if (error) {
          console.log(
            `[SWEEPER][OPTICAL][SOUND_ERROR] strong ${error.message}`,
          );
        }
      },
    );

    possibleSoundRef.current = possible;
    strongSoundRef.current = strong;

    return () => {
      possible.release();
      strong.release();
      possibleSoundRef.current = null;
      strongSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    console.log(
      `[SWEEPER][OPTICAL][TORCH] requested=${
        torchOn ? 'on' : 'off'
      }`,
    );
  }, [torchOn]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );

    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [pulse, sweep]);

  useEffect(() => {
    const reset = emptyStable();
    trackerRef.current = reset;
    holdRef.current = null;
    lockMotionRef.current = {
      x: null,
      y: null,
      emaMovement: 1,
      stableFrames: 0,
    };
    lockedTargetRef.current = null;
    lastAlertLevelRef.current = 'none';
    setState(reset);
    setMessage('');

    console.log(
      `[SWEEPER][OPTICAL] session mode=${mode} camera=${position} torch=${
        position === 'back' && torchOn ? 'on' : 'off'
      } detector=connected-components`,
    );
  }, [mode, position, torchOn]);

  const onAnalysis = useCallback(
    (analysis: OpticalFrameAnalysis) => {
      const previous = trackerRef.current;
      const now = Date.now();
      const torchActive = torchOnRef.current;
      const soundActive = soundEnabledRef.current;

      const inScanner = analysis.candidates.filter(candidate =>
        candidateIsInsideScanner(
          candidate,
          analysis.sourceWidth,
          analysis.sourceHeight,
        ),
      );

      let candidate =
        inScanner.length > 0 ? inScanner[0] : null;

      const lockedMemory = lockedTargetRef.current;

      if (
        analysis.mode === 'lens' &&
        lockedMemory &&
        now - lockedMemory.updatedAt <= LOCK_MEMORY_MAX_MS &&
        inScanner.length > 0
      ) {
        let memoryCandidate: OpticalCandidate | null = null;
        let memoryMetric = Number.POSITIVE_INFINITY;

        for (const option of inScanner) {
          const d = distance(lockedMemory.candidate, option);
          if (d > 0.12) continue;

          const areaRatio = Math.abs(
            Math.log(
              (option.area + 1) /
                (lockedMemory.candidate.area + 1),
            ),
          );
          const circularityDelta = Math.abs(
            option.circularity -
              lockedMemory.candidate.circularity,
          );

          if (areaRatio > 1.35 || circularityDelta > 0.45) {
            continue;
          }

          const metric =
            d * 2.15 +
            areaRatio * 0.055 +
            circularityDelta * 0.08 -
            option.score * 0.018;

          if (metric < memoryMetric) {
            memoryMetric = metric;
            memoryCandidate = option;
          }
        }

        if (memoryCandidate) {
          candidate = memoryCandidate;
        }
      }

      // V5 precision tracking:
      // Once a return has a track, favor spatial continuity over whichever
      // nearby reflection happens to win the raw score on a single frame.
      if (previous.candidate && inScanner.length > 0) {
        let tracked: OpticalCandidate | null = null;
        let trackedMetric = Number.POSITIVE_INFINITY;
        const searchRadius = previous.strong ? 0.085 : 0.11;

        for (const option of inScanner) {
          const d = distance(previous.candidate, option);

          if (d > searchRadius) continue;

          // Distance dominates. Score/circularity only break close ties.
          const metric =
            d * 1.75 -
            option.score * 0.035 -
            option.circularity * 0.018;

          if (metric < trackedMetric) {
            trackedMetric = metric;
            tracked = option;
          }
        }

        if (tracked) {
          candidate = tracked;
        }
      }

      let streak = 0;
      let averageScore = 0;

      if (candidate) {
        const trackDistance =
          previous.candidate != null
            ? distance(previous.candidate, candidate)
            : Number.POSITIVE_INFINITY;
        const sameTrack =
          previous.candidate != null &&
          trackDistance <= (previous.strong ? 0.08 : 0.105);

        if (sameTrack && previous.candidate) {
          // Adaptive smoothing: tiny detector jitter barely moves the marker,
          // while a genuine camera/phone movement still catches up promptly.
          const alpha =
            trackDistance <= 0.028
              ? 0.26
              : trackDistance <= 0.060
                ? 0.42
                : 0.58;

          candidate = {
            ...candidate,
            x:
              previous.candidate.x * (1 - alpha) +
              candidate.x * alpha,
            y:
              previous.candidate.y * (1 - alpha) +
              candidate.y * alpha,
          };
        }

        streak = sameTrack
          ? Math.min(40, previous.streak + 1)
          : 1;

        averageScore = sameTrack
          ? previous.averageScore * 0.68 +
            candidate.score * 0.32
          : candidate.score;

        const motion = lockMotionRef.current;

        if (
          sameTrack &&
          motion.x != null &&
          motion.y != null
        ) {
          const visualMovement = Math.hypot(
            candidate.x - motion.x,
            candidate.y - motion.y,
          );
          const emaMovement =
            motion.emaMovement * 0.72 +
            visualMovement * 0.28;
          const stableFrames =
            emaMovement <= 0.010
              ? Math.min(60, motion.stableFrames + 1)
              : emaMovement <= 0.018
                ? Math.max(0, motion.stableFrames)
                : Math.max(0, motion.stableFrames - 2);

          lockMotionRef.current = {
            x: candidate.x,
            y: candidate.y,
            emaMovement,
            stableFrames,
          };
        } else {
          lockMotionRef.current = {
            x: candidate.x,
            y: candidate.y,
            emaMovement: 0.05,
            stableFrames: 0,
          };
        }
      } else {
        streak = Math.max(0, previous.streak - 1);
        averageScore = previous.averageScore * 0.78;
      }

      // V5 has two Lens confidence profiles.
      //
      // Passive: works from ambient illumination with stricter persistence
      // and shape requirements. Useful for finding a point to investigate.
      //
      // Illuminated: the phone's steady scan light creates a controlled
      // reflection, so acquisition can be faster and a strong lock can happen
      // sooner without lowering confidence indiscriminately.
      const passiveLens =
        analysis.mode === 'lens' && !torchActive;

      const sizeUsable =
        candidate != null &&
        candidate.area >=
          (analysis.mode === 'lens' ? 4 : 8) &&
        candidate.area <=
          (analysis.mode === 'lens' ? 180 : 128);

      const sceneUsable =
        candidate != null &&
        (analysis.mode === 'lens'
          ? analysis.ambient >= (passiveLens ? 6 : 4)
          : !analysis.tooBrightForIr &&
            analysis.ambient <= 75 &&
            candidate.colorScore >= 0.30);

      const shapeUsable =
        candidate != null &&
        (analysis.mode !== 'lens' ||
          candidate.circularity >= (passiveLens ? 0.30 : 0.24));

      const liveVisible =
        candidate != null &&
        sizeUsable &&
        sceneUsable &&
        shapeUsable &&
        streak >=
          (analysis.mode === 'lens'
            ? passiveLens
              ? 3
              : 2
            : 5) &&
        averageScore >=
          (analysis.mode === 'lens'
            ? passiveLens
              ? 0.66
              : 0.62
            : 0.73);

      const liveStrong =
        candidate != null &&
        liveVisible &&
        streak >=
          (analysis.mode === 'lens'
            ? passiveLens
              ? 7
              : 5
            : 9) &&
        averageScore >=
          (analysis.mode === 'lens'
            ? passiveLens
              ? 0.79
              : 0.75
            : 0.82) &&
        candidate.circularity >=
          (analysis.mode === 'lens'
            ? passiveLens
              ? 0.47
              : 0.38
            : 0.50) &&
        (analysis.mode === 'lens'
          ? candidate.area >= (passiveLens ? 10 : 12)
          : candidate.colorScore >= 0.40);

      let visible = liveVisible;
      let strong = liveStrong;
      let held = false;
      let displayCandidate = candidate;
      let displayStreak = streak;
      let displayScore = averageScore;
      let displayAmbient = analysis.ambient;

      const existingHold = holdRef.current;

      if (liveStrong && candidate) {
        const motion = lockMotionRef.current;
        const strongHoldMs =
          motion.stableFrames >= 7 &&
          motion.emaMovement <= 0.010
            ? STABLE_STRONG_HOLD_MS
            : motion.stableFrames >= 3 &&
                motion.emaMovement <= 0.018
              ? STEADY_STRONG_HOLD_MS
              : STRONG_HOLD_MS;

        lockedTargetRef.current = {
          candidate,
          streak,
          averageScore,
          ambient: analysis.ambient,
          contours: analysis.contours,
          poolSize: inScanner.length,
          rawCandidates: analysis.rawCandidates,
          sourceWidth: analysis.sourceWidth,
          sourceHeight: analysis.sourceHeight,
          tooBrightForIr: analysis.tooBrightForIr,
          updatedAt: now,
          divergenceFrames: 0,
          missFrames: 0,
        };

        const hold: HeldOpticalState = {
          candidate,
          streak,
          averageScore,
          visible: true,
          strong: true,
          held: false,
          ambient: analysis.ambient,
          sourceWidth: analysis.sourceWidth,
          sourceHeight: analysis.sourceHeight,
          tooBrightForIr: analysis.tooBrightForIr,
          holdUntil: now + strongHoldMs,
        };

        holdRef.current = hold;
      } else if (liveVisible && candidate) {
        const sameAsStrongHold =
          existingHold?.strong &&
          existingHold.candidate != null &&
          distance(existingHold.candidate, candidate) <=
            (torchActive ? 0.075 : 0.065) &&
          now < existingHold.holdUntil;

        if (sameAsStrongHold && existingHold) {
          strong = true;
          displayCandidate = {
            ...candidate,
            x:
              existingHold.candidate!.x * 0.55 +
              candidate.x * 0.45,
            y:
              existingHold.candidate!.y * 0.55 +
              candidate.y * 0.45,
          };

          const hold: HeldOpticalState = {
            ...existingHold,
            candidate: displayCandidate,
            streak: Math.max(existingHold.streak, streak),
            averageScore: Math.max(
              existingHold.averageScore,
              averageScore,
            ),
            held: false,
            ambient: analysis.ambient,
            sourceWidth: analysis.sourceWidth,
            sourceHeight: analysis.sourceHeight,
            holdUntil: Math.max(
              existingHold.holdUntil,
              now +
                (lockMotionRef.current.stableFrames >= 5
                  ? 3000
                  : 1500),
            ),
          };

          holdRef.current = hold;
        } else {
          const hold: HeldOpticalState = {
            candidate,
            streak,
            averageScore,
            visible: true,
            strong: false,
            held: false,
            ambient: analysis.ambient,
            sourceWidth: analysis.sourceWidth,
            sourceHeight: analysis.sourceHeight,
            tooBrightForIr: analysis.tooBrightForIr,
            holdUntil: now + POSSIBLE_HOLD_MS,
          };

          holdRef.current = hold;
        }
      } else {
        const memory = lockedTargetRef.current;
        const memoryAge =
          memory != null
            ? now - memory.updatedAt
            : Number.POSITIVE_INFINITY;

        const ambientDelta =
          memory != null
            ? Math.abs(analysis.ambient - memory.ambient)
            : Number.POSITIVE_INFINITY;
        const contourDelta =
          memory != null
            ? Math.abs(analysis.contours - memory.contours)
            : Number.POSITIVE_INFINITY;
        const poolDelta =
          memory != null
            ? Math.abs(inScanner.length - memory.poolSize)
            : Number.POSITIVE_INFINITY;

        const sceneStable =
          memory != null &&
          memoryAge <= LOCK_MEMORY_MAX_MS &&
          ambientDelta <= 24 &&
          contourDelta <=
            Math.max(20, memory.contours * 0.65) &&
          poolDelta <=
            Math.max(3, memory.poolSize * 1.75);

        const credibleFarCandidate =
          memory != null &&
          candidate != null &&
          candidate.score >= 0.74 &&
          distance(memory.candidate, candidate) > 0.18;

        let divergenceFrames =
          memory?.divergenceFrames ?? 0;

        if (memory) {
          divergenceFrames =
            credibleFarCandidate && !sceneStable
              ? Math.min(
                  LOCK_DIVERGENCE_FRAMES,
                  divergenceFrames + 1,
                )
              : Math.max(0, divergenceFrames - 1);

          lockedTargetRef.current = {
            ...memory,
            divergenceFrames,
            missFrames: memory.missFrames + 1,
          };
        }

        const memoryExpired =
          memory == null ||
          memoryAge > LOCK_MEMORY_MAX_MS ||
          divergenceFrames >= LOCK_DIVERGENCE_FRAMES;

        if (memoryExpired) {
          holdRef.current = null;
          lockedTargetRef.current = null;
          visible = false;
          strong = false;
          held = false;
        } else if (
          existingHold &&
          now < existingHold.holdUntil &&
          existingHold.candidate
        ) {
          visible = true;
          strong = existingHold.strong;
          held = true;
          displayCandidate = existingHold.candidate;
          displayStreak = existingHold.streak;
          displayScore = existingHold.averageScore;
          displayAmbient = existingHold.ambient;
        } else if (
          memory &&
          sceneStable &&
          lockMotionRef.current.stableFrames >= 3
        ) {
          // COASTING: the exact optical glint disappeared, but the recent
          // scene and target geometry still say the camera is essentially
          // looking at the same place. Keep the last locked point briefly.
          const coastUntil = Math.min(
            memory.updatedAt + LOCK_MEMORY_MAX_MS,
            now + 900,
          );

          visible = true;
          strong = true;
          held = true;
          displayCandidate = memory.candidate;
          displayStreak = memory.streak;
          displayScore = memory.averageScore;
          displayAmbient = memory.ambient;

          holdRef.current = {
            candidate: memory.candidate,
            streak: memory.streak,
            averageScore: memory.averageScore,
            visible: true,
            strong: true,
            held: true,
            ambient: memory.ambient,
            sourceWidth: memory.sourceWidth,
            sourceHeight: memory.sourceHeight,
            tooBrightForIr: memory.tooBrightForIr,
            holdUntil: coastUntil,
          };
        } else {
          holdRef.current = null;
        }
      }

      const next: StableOpticalState = {
        candidate: displayCandidate,
        streak: displayStreak,
        averageScore: displayScore,
        visible,
        strong,
        held,
        ambient: displayAmbient,
        sourceWidth: analysis.sourceWidth,
        sourceHeight: analysis.sourceHeight,
        tooBrightForIr: analysis.tooBrightForIr,
      };

      trackerRef.current = {
        candidate,
        streak,
        averageScore,
        visible: liveVisible,
        strong: liveStrong,
        held: false,
        ambient: analysis.ambient,
        sourceWidth: analysis.sourceWidth,
        sourceHeight: analysis.sourceHeight,
        tooBrightForIr: analysis.tooBrightForIr,
      };
      setState(next);

      const alertLevel = strong
        ? 'strong'
        : visible
          ? 'possible'
          : 'none';

      if (alertLevel !== lastAlertLevelRef.current) {
        const previousLevel = lastAlertLevelRef.current;
        lastAlertLevelRef.current = alertLevel;

        console.log(
          `[SWEEPER][OPTICAL][ALERT] level=${alertLevel} previous=${previousLevel} mode=${analysis.mode} illumination=${analysis.mode === 'lens' ? (torchActive ? 'active' : 'passive') : 'n/a'} held=${
            held ? 'yes' : 'no'
          } x=${
            displayCandidate
              ? displayCandidate.x.toFixed(3)
              : 'n/a'
          } y=${
            displayCandidate
              ? displayCandidate.y.toFixed(3)
              : 'n/a'
          } score=${displayScore.toFixed(2)} streak=${displayStreak}`,
        );

        if (
          analysis.mode === 'lens' &&
          soundActive &&
          !held &&
          alertLevel === 'possible' &&
          now - lastPossibleSoundRef.current >
            POSSIBLE_SOUND_COOLDOWN_MS
        ) {
          lastPossibleSoundRef.current = now;
          possibleSoundRef.current?.stop(() => {
            possibleSoundRef.current?.play();
          });
        }

        if (
          analysis.mode === 'lens' &&
          soundActive &&
          !held &&
          alertLevel === 'strong' &&
          now - lastStrongSoundRef.current >
            STRONG_SOUND_COOLDOWN_MS
        ) {
          lastStrongSoundRef.current = now;
          strongSoundRef.current?.stop(() => {
            strongSoundRef.current?.play();
          });
        }

        if (
          analysis.mode === 'lens' &&
          !held &&
          alertLevel === 'possible'
        ) {
          Vibration.vibrate(35);
        }
      }

      if (
        liveStrong &&
        now - lastHapticRef.current > 1600
      ) {
        lastHapticRef.current = now;
        Vibration.vibrate([0, 45, 35, 75, 35, 105]);
      }

      if (now - lastLogRef.current > 500) {
        lastLogRef.current = now;

        console.log(
          `[SWEEPER][OPTICAL][FRAME] mode=${analysis.mode} ambient=${analysis.ambient.toFixed(
            1,
          )} contours=${analysis.contours} raw=${analysis.rawCandidates} pool=${
            inScanner.length
          } best=${
            candidate
              ? candidate.score.toFixed(2)
              : 'none'
          } circ=${
            candidate
              ? candidate.circularity.toFixed(2)
              : 'n/a'
          } area=${
            candidate
              ? candidate.area.toFixed(1)
              : 'n/a'
          } color=${
            candidate
              ? candidate.colorScore.toFixed(2)
              : 'n/a'
          } fill=${
            candidate
              ? candidate.fill.toFixed(2)
              : 'n/a'
          } torch=${
            analysis.mode === 'lens' && torchActive
              ? 'on'
              : 'off'
          } streak=${streak} live=${
            liveVisible ? 'yes' : 'no'
          } visible=${visible ? 'yes' : 'no'} strong=${
            strong ? 'yes' : 'no'
          } held=${held ? 'yes' : 'no'} x=${
            candidate ? candidate.x.toFixed(3) : 'n/a'
          } y=${
            candidate ? candidate.y.toFixed(3) : 'n/a'
          } motion=${lockMotionRef.current.emaMovement.toFixed(
            4,
          )} stableFrames=${lockMotionRef.current.stableFrames} holdMs=${
            holdRef.current
              ? Math.max(
                  0,
                  holdRef.current.holdUntil - now,
                )
              : 0
          } illumination=${
            analysis.mode === 'lens'
              ? torchActive
                ? 'active'
                : 'passive'
              : 'n/a'
          } memoryAge=${
            lockedTargetRef.current
              ? now - lockedTargetRef.current.updatedAt
              : -1
          } divergence=${
            lockedTargetRef.current?.divergenceFrames ?? 0
          } misses=${
            lockedTargetRef.current?.missFrames ?? 0
          }`,
        );
      }
    },
    [candidateIsInsideScanner],
  );

  const onPipelineIssue = useCallback((issue: string) => {
    console.log(`[SWEEPER][OPTICAL][PIPELINE] ${issue}`);
  }, []);

  const selectLens = () => {
    setMode('lens');
    setPosition('back');
    setTorchOn(false);
  };

  const selectIr = () => {
    setMode('ir');
    setTorchOn(false);
    // Camera position intentionally does not change. The user decides whether
    // to try the front camera.
  };

  const capture = async () => {
    if (capturing) return;

    setCapturing(true);
    setMessage('');

    try {
      const path = await cameraRef.current?.capture();

      if (!path) {
        throw new Error('Camera capture was unavailable.');
      }

      const createdAt = new Date().toISOString();

      onPhoto({
        path,
        createdAt,
      });

      if (state.visible && state.candidate) {
        console.log(
          `[SWEEPER][OPTICAL] evidence-captured mode=${mode} score=${state.averageScore.toFixed(
            2,
          )} streak=${state.streak} circularity=${state.candidate.circularity.toFixed(
            2,
          )}`,
        );
        setMessage('Saved with the optical clue visible.');
      } else {
        setMessage('Photo saved.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the photo.',
      );
    } finally {
      setCapturing(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const hold = holdRef.current;

      if (!hold || Date.now() < hold.holdUntil) {
        return;
      }

      holdRef.current = null;
      setState(current =>
        current.visible
          ? {
              ...emptyStable(),
              ambient: current.ambient,
              sourceWidth: current.sourceWidth,
              sourceHeight: current.sourceHeight,
              tooBrightForIr: current.tooBrightForIr,
            }
          : current,
      );
    }, 250);

    return () => clearInterval(timer);
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>
          Camera Scanner
        </Text>
        <Text style={styles.permissionBody}>
          Sweeper analyzes the live camera feed on this
          iPhone. Frames stay on-device and are not saved
          unless you capture a photo.
        </Text>

        <PrimaryButton
          title="ENABLE CAMERA"
          onPress={async () => {
            const granted =
              await requestPermission();

            if (!granted) {
              setMessage(
                'Camera permission was not granted.',
              );
            }
          }}
        />

        {message ? (
          <Text style={styles.message}>
            {message}
          </Text>
        ) : null}

        <SecondaryButton title="Done" onPress={onDone} />
      </View>
    );
  }

  const candidate = state.candidate;

  let markerStyle: {
    left: number;
    top: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null = null;

  if (state.visible && candidate) {
    const point = projectCandidate(
      candidate,
      state.sourceWidth,
      state.sourceHeight,
    );
    const radius = state.strong ? 18 : 13;

    markerStyle = {
      left: point.x - radius,
      top: point.y - radius,
      width: radius * 2,
      height: radius * 2,
      borderRadius: radius,
    };
  }

  const alertColor =
    mode === 'lens'
      ? state.strong
        ? torchOn
          ? '#ff4d4f'
          : '#ff7a45'
        : '#ffb44d'
      : '#b889ff';

  const statusTitle = state.visible
    ? mode === 'lens'
      ? state.strong
        ? state.held
          ? 'HOLDING TARGET'
          : torchOn
            ? 'TARGET LOCKED'
            : 'TARGET LOCKED'
        : torchOn
          ? 'Possible camera detected'
          : 'Possible passive reflection'
      : state.strong
        ? 'Strong IR light source'
        : 'Possible IR light source'
    : mode === 'lens'
      ? !torchOn
        ? 'Passive lens scan'
        : state.ambient < 12
          ? 'Move closer - return too dim'
          : 'Sweep slowly'
      : state.tooBrightForIr
        ? 'Room is too bright for IR'
        : 'Scan in a dark room';

  const statusBody = state.visible
    ? mode === 'lens'
      ? state.strong
        ? state.held
          ? 'Optical return briefly lost. Stable-lock memory is holding the last target while the camera remains visually steady; re-aim at that exact point to confirm.'
          : 'Strong persistent lens-like return LOCKED at the red target. Inspect that exact point and change angle slightly to confirm.'
        : state.held
          ? 'Possible return briefly lost. Sweeper is holding the last position momentarily so you can confirm the same point.'
          : 'Possible lens-like return at the orange target. Keep it centered while you change your angle slowly.'
      : state.strong
        ? state.held
          ? 'Holding the last strong IR point briefly so you can re-aim at the same source.'
          : 'Strong IR-like source at the purple target. Change angle and verify it before saving evidence.'
        : state.held
          ? 'Holding the possible IR source briefly so you can re-aim at the same point.'
          : 'Possible IR-like source at the purple target. Keep it centered and verify it in darkness.'
    : mode === 'lens'
      ? torchOn
        ? state.ambient < 12
          ? 'The scene is too dark for a reliable lens call. Move closer so the steady scan light reaches the object.'
          : 'Stay about 1 to 5 feet from the object and change your angle slowly. Sweeper is looking for one compact return that persists.'
        : 'Passive mode can flag compact ambient reflections. Turn on the steady scan light and re-aim at the same point for a much higher-confidence confirmation.'
      : state.tooBrightForIr
        ? 'Turn the room lights off or make the area darker, then scan again.'
        : 'Look for small white or purple points from night-vision illuminators. IR visibility varies by iPhone camera.';

  return (
    <View style={styles.container}>
      <CameraHost
        ref={cameraRef}
        mode={mode}
        position={position}
        torchOn={torchOn}
        onAnalysis={onAnalysis}
        onPipelineIssue={onPipelineIssue}
      />

      <View style={[styles.topBar, {top: insets.top + 8}]}>
        <Pressable
          onPress={selectLens}
          style={[
            styles.mode,
            mode === 'lens' && styles.modeLens,
          ]}>
          <Text
            style={[
              styles.modeText,
              mode === 'lens' && styles.modeTextActive,
            ]}>
            LENS
          </Text>
        </Pressable>

        <Pressable
          onPress={selectIr}
          style={[
            styles.mode,
            mode === 'ir' && styles.modeIr,
          ]}>
          <Text
            style={[
              styles.modeText,
              mode === 'ir' && styles.modeTextActive,
            ]}>
            IR
          </Text>
        </Pressable>

        <Pressable
          onPress={onDone}
          style={styles.doneButton}>
          <Text style={styles.doneText}>DONE</Text>
        </Pressable>
      </View>

      <View style={styles.scannerWrap}>
        <Animated.View
          style={[
            styles.outerRing,
            state.visible && {
              borderColor: alertColor,
              shadowColor: alertColor,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 1],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.08],
                  }),
                },
              ],
            },
          ]}
        />

        <View
          style={[
            styles.scanCircle,
            state.visible && {
              borderColor: alertColor,
              borderWidth: state.strong ? 7 : 5,
              backgroundColor:
                mode === 'lens'
                  ? state.strong
                    ? 'rgba(255,77,79,0.18)'
                    : 'rgba(255,180,77,0.10)'
                  : 'rgba(184,137,255,0.10)',
            },
          ]}>
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        -SCAN_SIZE / 2 + 18,
                        SCAN_SIZE / 2 - 18,
                      ],
                    }),
                  },
                ],
              },
            ]}
          />

          {mode === 'lens' ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scannerPulseOuter,
                  {
                    borderColor:
                      state.visible
                        ? alertColor
                        : torchOn
                          ? '#ffb44d'
                          : '#66778b',
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: state.held
                        ? [0.72, 0.20]
                        : state.visible
                          ? [0.58, 0.16]
                          : [0.30, 0.08],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: state.held
                            ? [0.970, 1.055]
                            : state.strong
                              ? [0.978, 1.045]
                              : [0.985, 1.035],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scannerPulseInner,
                  {
                    borderColor:
                      state.visible
                        ? alertColor
                        : torchOn
                          ? '#ffcf8a'
                          : '#566476',
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.10, 0.34],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.018, 0.992],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </>
          ) : null}

          {state.visible && mode === 'lens' ? (
            <View
              pointerEvents="none"
              style={[
                styles.alertReticle,
                {
                  borderColor: alertColor,
                  opacity: state.strong ? 1 : 0.72,
                },
              ]}>
              {state.strong ? (
                <>
                  <View
                    style={[
                      styles.lockBracket,
                      styles.lockBracketTl,
                      {borderColor: alertColor},
                    ]}
                  />
                  <View
                    style={[
                      styles.lockBracket,
                      styles.lockBracketTr,
                      {borderColor: alertColor},
                    ]}
                  />
                  <View
                    style={[
                      styles.lockBracket,
                      styles.lockBracketBl,
                      {borderColor: alertColor},
                    ]}
                  />
                  <View
                    style={[
                      styles.lockBracket,
                      styles.lockBracketBr,
                      {borderColor: alertColor},
                    ]}
                  />
                  <Text
                    style={[
                      styles.lockLabel,
                      {color: alertColor},
                    ]}>
                    TARGET LOCK
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

        </View>
      </View>

      {markerStyle ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.preciseMarker,
            markerStyle,
            state.strong
              ? styles.preciseMarkerStrong
              : styles.preciseMarkerPossible,
            {
              borderColor: alertColor,
              shadowColor: alertColor,
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: state.strong
                      ? [0.96, 1.10]
                      : [0.98, 1.06],
                  }),
                },
              ],
            },
          ]}>
          <View
            style={[
              styles.preciseMarkerH,
              {backgroundColor: alertColor},
            ]}
          />
          <View
            style={[
              styles.preciseMarkerV,
              {backgroundColor: alertColor},
            ]}
          />
          <View
            style={[
              styles.preciseMarkerCore,
              {backgroundColor: alertColor},
            ]}
          />
          {state.strong ? (
            <Animated.View
              style={[
                styles.lockHalo,
                {
                  borderColor: alertColor,
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.35],
                      }),
                    },
                  ],
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 0.20],
                  }),
                },
              ]}
            />
          ) : null}
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.bottomPanel,
          {bottom: Math.max(insets.bottom + 6, 12)},
        ]}>
        <Text
          style={[
            styles.statusTitle,
            state.visible && {color: alertColor},
          ]}>
          {statusTitle}
        </Text>

        <Text style={styles.statusBody}>
          {statusBody}
        </Text>

        <View style={styles.toolRow}>
          {mode === 'lens' ? (
            <Pressable
              onPress={() => setTorchOn(value => !value)}
              style={[
                styles.toolButton,
                torchOn && styles.toolButtonOn,
              ]}>
              <Text style={styles.toolText}>
                {torchOn
                  ? 'SCAN LIGHT ON'
                  : 'TURN ON SCAN LIGHT'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                setPosition(value =>
                  value === 'back' ? 'front' : 'back',
                )
              }
              style={styles.toolButton}>
              <Text style={styles.toolText}>
                USE {position === 'back' ? 'FRONT' : 'REAR'} CAMERA
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setSoundEnabled(value => !value)}
            style={[
              styles.soundButton,
              soundEnabled && styles.soundButtonOn,
            ]}>
            <Text style={styles.soundButtonText}>
              {soundEnabled ? 'SOUND ON' : 'MUTED'}
            </Text>
          </Pressable>

          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>
              {position.toUpperCase()}
            </Text>
          </View>
        </View>

        {state.visible ? (
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                {
                  width: `${Math.round(
                    Math.max(
                      0,
                      Math.min(1, state.averageScore),
                    ) * 100,
                  )}%`,
                  backgroundColor: alertColor,
                },
              ]}
            />
          </View>
        ) : null}

        {message ? (
          <Text style={styles.message}>
            {message}
          </Text>
        ) : null}

        <PrimaryButton
          title={
            state.visible
              ? 'SAVE THIS SPOT'
              : 'TAKE A PHOTO'
          }
          onPress={capture}
          loading={capturing}
        />

        {mode === 'ir' ? (
          <Text style={styles.irTip}>
            If IR is not visible, try the other camera. A TV
            remote can be used as an optional sensitivity
            check.
          </Text>
        ) : null}

        <Text style={styles.disclaimer}>
          Glass, LEDs and polished surfaces can also reflect
          brightly. A highlighted point is a reason to inspect,
          not proof of a hidden camera.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permission: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  permissionTitle: {
    color: palette.text,
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 12,
  },
  permissionBody: {
    color: palette.muted,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 12,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 54,
    borderRadius: 18,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(5,9,15,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(90,120,155,0.45)',
  },
  mode: {
    flex: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLens: {
    backgroundColor: '#10342f',
  },
  modeIr: {
    backgroundColor: '#281c43',
  },
  modeText: {
    color: '#8492a4',
    fontWeight: '900',
    letterSpacing: 1,
  },
  modeTextActive: {
    color: '#fff',
  },
  doneButton: {
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: '#192330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: '#dce5ee',
    fontWeight: '900',
    fontSize: 12,
  },
  scannerWrap: {
    position: 'absolute',
    width: SCAN_SIZE + 46,
    height: SCAN_SIZE + 46,
    left: '50%',
    top: '43%',
    marginLeft: -(SCAN_SIZE + 46) / 2,
    marginTop: -(SCAN_SIZE + 46) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: SCAN_SIZE + 34,
    height: SCAN_SIZE + 34,
    borderRadius: (SCAN_SIZE + 34) / 2,
    borderWidth: 3,
    borderColor: 'rgba(85,214,190,0.42)',
    shadowOpacity: 0.95,
    shadowRadius: 18,
  },
  scanCircle: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    borderWidth: 3,
    borderColor: '#55d6be',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '50%',
    height: 2,
    backgroundColor: 'rgba(85,214,190,0.68)',
    shadowColor: '#55d6be',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  preciseMarker: {
    position: 'absolute',
    zIndex: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 1,
  },
  preciseMarkerPossible: {
    shadowRadius: 9,
    backgroundColor: 'rgba(255,180,77,0.08)',
  },
  preciseMarkerStrong: {
    borderWidth: 3,
    shadowRadius: 14,
    backgroundColor: 'rgba(255,77,79,0.10)',
  },
  preciseMarkerH: {
    position: 'absolute',
    width: 14,
    height: 1,
  },
  preciseMarkerV: {
    position: 'absolute',
    width: 1,
    height: 14,
  },
  preciseMarkerCore: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  lockHalo: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
  },
  scannerPulseOuter: {
    ...StyleSheet.absoluteFill,
    margin: 5,
    borderRadius: SCAN_SIZE,
    borderWidth: 1.5,
  },
  scannerPulseInner: {
    ...StyleSheet.absoluteFill,
    margin: 14,
    borderRadius: SCAN_SIZE,
    borderWidth: 1,
  },
  alertReticle: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBracket: {
    position: 'absolute',
    width: 34,
    height: 34,
  },
  lockBracketTl: {
    left: 18,
    top: 18,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  lockBracketTr: {
    right: 18,
    top: 18,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  lockBracketBl: {
    left: 18,
    bottom: 18,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  lockBracketBr: {
    right: 18,
    bottom: 18,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  lockLabel: {
    position: 'absolute',
    top: 18,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  bottomPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(85,214,190,0.30)',
    backgroundColor: 'rgba(4,8,14,0.95)',
    padding: 15,
  },
  statusTitle: {
    color: '#55d6be',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
  },
  statusBody: {
    color: '#e1e8ef',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 5,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  toolButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#405166',
    backgroundColor: '#151e2a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolButtonOn: {
    borderColor: '#55d6be',
    backgroundColor: '#11372f',
  },
  toolText: {
    color: '#f2f6fa',
    fontSize: 11,
    fontWeight: '900',
  },
  soundButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a5667',
    backgroundColor: '#121a24',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  soundButtonOn: {
    borderColor: '#ffb44d',
    backgroundColor: 'rgba(255,180,77,0.12)',
  },
  soundButtonText: {
    color: '#e8edf3',
    fontSize: 9,
    fontWeight: '900',
  },
  cameraBadge: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d4d61',
    backgroundColor: '#101722',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  cameraBadgeText: {
    color: '#91a1b4',
    fontSize: 10,
    fontWeight: '900',
  },
  scoreTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: '#263342',
    overflow: 'hidden',
    marginTop: 10,
  },
  scoreFill: {
    height: '100%',
  },
  message: {
    color: '#55d6be',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 8,
  },
  irTip: {
    color: '#a98aff',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
    textAlign: 'center',
  },
  disclaimer: {
    color: '#728294',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
