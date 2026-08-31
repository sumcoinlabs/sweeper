import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {
  Body,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Title,
  palette,
} from '../components/ui';
import type {EvidencePhoto} from '../types';

export function CameraAssistScreen({
  onPhoto,
  onDone,
}: {
  onPhoto: (photo: EvidencePhoto) => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {hasPermission, requestPermission} = useCameraPermission();
  const [useFront, setUseFront] = useState(false);
  const [message, setMessage] = useState('');
  const [capturing, setCapturing] = useState(false);
  const device = useCameraDevice(useFront ? 'front' : 'back');
  const photoOutput = usePhotoOutput({
    qualityPrioritization: 'balanced',
    quality: 0.85,
  });

  const takePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    setMessage('');

    try {
      const result = await photoOutput.capturePhotoToFile(
        {flashMode: 'off'},
        {},
      );
      onPhoto({
        path: result.filePath,
        createdAt: new Date().toISOString(),
      });
      setMessage('Evidence photo added to this sweep.');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Unable to capture a photo.',
      );
    } finally {
      setCapturing(false);
    }
  };

  if (!hasPermission) {
    return (
      <Screen>
        <View style={styles.center}>
          <Title>Lens Assist</Title>
          <Body>
            Camera access is used only while Lens Assist is open. Photos are kept
            with this sweep only when you choose to capture one.
          </Body>
          <PrimaryButton
            title="ENABLE CAMERA"
            onPress={async () => {
              const granted = await requestPermission();
              if (!granted) {
                setMessage('Camera permission was not granted.');
              }
            }}
          />
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <SecondaryButton title="Back to physical check" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  if (!device) {
    return (
      <Screen>
        <View style={styles.center}>
          <Title>Lens Assist needs a camera</Title>
          <Body>
            No usable camera is available in this environment. That is common
            when testing in the iOS Simulator. The camera step should be
            validated on a physical iPhone.
          </Body>
          <SecondaryButton title="Back to physical check" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[photoOutput]}
      />

      <View style={[styles.overlayTop, {top: insets.top + 10}]}>
        <Text style={styles.heading}>LENS ASSIST</Text>
        <Text style={styles.help}>
          Move slowly and inspect suspicious objects for a tiny lens-like
          reflection. A bright reflection by itself is not proof of a camera.
        </Text>
      </View>

      <View style={styles.reticle} />

      <View
        style={[
          styles.controls,
          {bottom: Math.max(16, insets.bottom + 8)},
        ]}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <PrimaryButton
          title="CAPTURE EVIDENCE PHOTO"
          onPress={takePhoto}
          loading={capturing}
        />
        <SecondaryButton
          title={useFront ? 'Use rear camera' : 'Use front camera'}
          onPress={() => setUseFront(value => !value)}
        />
        <SecondaryButton title="Done" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  center: {flex: 1, justifyContent: 'center', paddingBottom: 24},
  error: {
    color: palette.danger,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },
  overlayTop: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(5,8,12,0.78)',
    borderRadius: 16,
    padding: 14,
  },
  heading: {
    color: palette.accent,
    fontWeight: '900',
    letterSpacing: 2,
  },
  help: {color: palette.text, fontSize: 13, lineHeight: 19, marginTop: 6},
  reticle: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 66,
    left: '50%',
    top: '44%',
    marginLeft: -66,
    marginTop: -66,
  },
  controls: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(5,8,12,0.82)',
    borderRadius: 18,
    padding: 14,
  },
  message: {
    color: palette.accent,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 19,
  },
});
