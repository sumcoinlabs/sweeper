import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Body, Card, PrimaryButton, Screen, Subtitle, Title, palette} from '../components/ui';

export function HomeScreen({onStart}: {onStart: () => void}) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.brand}>SWEEPER</Text>
          <Title>Check a room for signs of hidden surveillance.</Title>
          <Body>
            Sweep the local network, look for nearby Bluetooth devices, inspect common hiding spots, and document anything suspicious.
          </Body>
        </View>

        <Card>
          <Subtitle>What Sweeper checks</Subtitle>
          <Text style={styles.item}>• Local-network services commonly used by cameras and embedded devices</Text>
          <Text style={styles.item}>• Nearby Bluetooth devices and signal strength</Text>
          <Text style={styles.item}>• Common physical hiding locations</Text>
          <Text style={styles.item}>• Photos you choose to save as evidence</Text>
        </Card>

        <Card>
          <Subtitle>Privacy first</Subtitle>
          <Body>
            Scanning happens on your device. Nothing is uploaded until you choose to submit the sweep.
          </Body>
        </Card>

        <View style={styles.action}>
          <PrimaryButton title="START A SWEEP" onPress={onStart} />
          <Text style={styles.disclaimer}>A suspicious device is not automatically a hidden camera.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flexGrow: 1, paddingTop: 10, paddingBottom: 12, gap: 18},
  hero: {marginBottom: 2},
  brand: {color: palette.accent, fontWeight: '900', letterSpacing: 4, marginBottom: 12},
  item: {color: palette.text, fontSize: 15, lineHeight: 25, marginBottom: 3},
  action: {marginTop: 'auto'},
  disclaimer: {color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10, paddingHorizontal: 14},
});
