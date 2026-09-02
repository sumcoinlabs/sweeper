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
} from 'react-native';
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
  type OpticalCandidate,
  type OpticalFrameAnalysis,
  type OpticalMode,
} from '../services/lensCv';
import type {EvidencePhoto} from '../types';

const ANALYSIS_WIDTH = 240;
const ANALYSIS_HEIGHT = 320;
const SCAN_SIZE = 292;

type StableOpticalState = {
  candidate: OpticalCandidate | null;
  streak: number;
  averageScore: number;
  visible: boolean;
  strong: boolean;
  ambient: number;
  tooBrightForIr: boolean;
};

type CameraHostHandle = {
  capture: () => Promise<string>;
};

type CameraHostProps = {
  mode: OpticalMode;
  position: 'front' | 'back';
  torchOn: boolean;
  onAnalysis: (analysis: OpticalFrameAnalysis) => void;
};

const CameraHost = memo(
  forwardRef<CameraHostHandle, CameraHostProps>(
    function CameraHost(
      {mode, position, torchOn, onAnalysis},
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

      const frameOutput = useFrameOutput({
        pixelFormat: 'yuv',
        targetResolution: {
          width: 480,
          height: 640,
        },
        enablePhysicalBufferRotation: false,
        dropFramesWhileBusy: true,
        allowDeferredStart: true,
        onFrame(frame) {
          'worklet';

          try {
            const runtime = globalThis as unknown as {
              __sweeperOpticalLastMs?: number;
            };

            const now = Date.now();
            const last = runtime.__sweeperOpticalLastMs || 0;

            // Five analyses per second is sufficient for deliberate room
            // sweeping and keeps the camera session light.
            if (now - last < 200) {
              return;
            }

            runtime.__sweeperOpticalLastMs = now;

            if (resizer == null) {
              return;
            }

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
          } finally {
            frame.dispose();
          }
        },
        onFrameDropped(reason) {
          'worklet';
          if (reason !== 'out-of-buffers') {
            // Kept intentionally silent in normal operation.
          }
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
          torchMode={
            position === 'back' && torchOn
              ? 'on'
              : 'off'
          }
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
    ambient: 0,
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
  const {hasPermission, requestPermission} =
    useCameraPermission();

  const cameraRef = useRef<CameraHostHandle>(null);
  const trackerRef = useRef<StableOpticalState>(
    emptyStable(),
  );
  const lastLogRef = useRef(0);
  const lastHapticRef = useRef(0);

  const [mode, setMode] =
    useState<OpticalMode>('lens');
  const [position, setPosition] =
    useState<'front' | 'back'>('back');
  const [torchOn, setTorchOn] = useState(false);
  const [state, setState] =
    useState<StableOpticalState>(emptyStable());
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState('');

  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

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
      const candidate = analysis.candidate;

      let streak = 0;
      let averageScore = 0;

      if (candidate) {
        const sameTrack =
          previous.candidate != null &&
          distance(previous.candidate, candidate) <= 0.095;

        streak = sameTrack
          ? Math.min(30, previous.streak + 1)
          : 1;

        averageScore = sameTrack
          ? previous.averageScore * 0.72 +
            candidate.score * 0.28
          : candidate.score;
      } else {
        streak = Math.max(0, previous.streak - 2);
        averageScore =
          previous.averageScore * 0.7;
      }

      const visible =
        candidate != null &&
        streak >= 4 &&
        averageScore >=
          (analysis.mode === 'lens' ? 0.64 : 0.67);

      const strong =
        visible &&
        streak >= 8 &&
        averageScore >=
          (analysis.mode === 'lens' ? 0.75 : 0.78) &&
        candidate.circularity >= 0.38;

      const next: StableOpticalState = {
        candidate,
        streak,
        averageScore,
        visible,
        strong,
        ambient: analysis.ambient,
        tooBrightForIr: analysis.tooBrightForIr,
      };

      trackerRef.current = next;

      // This state update only changes the overlay. CameraHost is memoized,
      // so the actual Camera session is not reconfigured as detections move.
      setState(next);

      const now = Date.now();

      if (strong && now - lastHapticRef.current > 2500) {
        lastHapticRef.current = now;
        Vibration.vibrate(45);
      }

      if (now - lastLogRef.current > 1000) {
        lastLogRef.current = now;

        console.log(
          `[SWEEPER][OPTICAL][FRAME] mode=${analysis.mode} ambient=${analysis.ambient.toFixed(
            1,
          )} contours=${analysis.contours} raw=${analysis.rawCandidates} best=${
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
          } streak=${streak} visible=${
            visible ? 'yes' : 'no'
          } strong=${strong ? 'yes' : 'no'}`,
        );
      }
    },
    [],
  );

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

  const markerStyle =
    state.visible && candidate
      ? {
          left: candidate.x * SCAN_SIZE - 17,
          top: candidate.y * SCAN_SIZE - 17,
        }
      : null;

  const alertColor =
    mode === 'lens' ? '#ffb44d' : '#b889ff';

  const statusTitle = state.visible
    ? mode === 'lens'
      ? state.strong
        ? 'Strong lens-like reflection'
        : 'Possible lens reflection'
      : state.strong
        ? 'Strong IR light source'
        : 'Possible IR light source'
    : mode === 'lens'
      ? torchOn
        ? 'Sweep slowly'
        : 'Turn on the scan light'
      : state.tooBrightForIr
        ? 'Room is too bright for IR'
        : 'Scan in a dark room';

  const statusBody = state.visible
    ? state.strong
      ? 'Move closer and change your angle. If this compact point stays visible, save a photo and inspect the object.'
      : 'Keep the point inside the circle for another moment.'
    : mode === 'lens'
      ? torchOn
        ? 'Stay about 1 to 5 feet from the object and change your angle slowly. Sweeper is looking for a small, compact return.'
        : 'The flashlight will stay steadily on once you enable it. It will not pulse with detections.'
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
                  ? 'rgba(255,180,77,0.10)'
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

          {markerStyle ? (
            <Animated.View
              style={[
                styles.marker,
                markerStyle,
                {
                  borderColor: alertColor,
                  shadowColor: alertColor,
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1.4],
                      }),
                    },
                  ],
                },
              ]}>
              <View
                style={[
                  styles.markerCore,
                  {backgroundColor: alertColor},
                ]}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>

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
  marker: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  markerCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
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
