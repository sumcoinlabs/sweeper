import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  Body,
  Card,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Subtitle,
  Title,
  palette,
} from '../components/ui';

export function HomeScreen({
  onStart,
  onCameraScan,
}: {
  onStart: () => void;
  onCameraScan: () => void;
}) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.brand}>SWEEPER</Text>
          <Title>Check a room for signs of hidden surveillance.</Title>
          <Body>
            Use the camera scanner immediately, or run the full room sweep for
            Wi-Fi, Bluetooth, physical and optical evidence together.
          </Body>
        </View>

        <Card style={styles.cameraCard}>
          <Text style={styles.quick}>QUICK CAMERA TOOL</Text>
          <Subtitle>Lens & IR Scanner</Subtitle>
          <Body>
            Look for lens-like reflections and infrared night-vision light.
            No Wi-Fi scan or checklist is required.
          </Body>
          <PrimaryButton title="OPEN CAMERA SCANNER" onPress={onCameraScan} />
        </Card>

        <Card>
          <Subtitle>Full room sweep</Subtitle>
          <Body>
            Combines network, Bluetooth, physical inspection and camera
            evidence into one assessment.
          </Body>
          <SecondaryButton title="START FULL SWEEP" onPress={onStart} />
        </Card>

        <Text style={styles.disclaimer}>
          No phone-only detector can guarantee a room is camera-free. Sweeper
          highlights evidence worth inspecting instead of making automatic
          accusations.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 18,
  },
  hero: {
    marginBottom: 2,
  },
  brand: {
    color: palette.accent,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 12,
  },
  cameraCard: {
    borderColor: '#55d6be',
    backgroundColor: '#101b22',
  },
  quick: {
    color: '#55d6be',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  disclaimer: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 14,
  },
});
