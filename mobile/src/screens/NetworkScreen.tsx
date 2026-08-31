import React, {useState} from 'react';
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
import {scanLocalNetwork} from '../services/networkScanner';
import type {NetworkDevice} from '../types';

export function NetworkScreen({
  initial,
  onContinue,
  onBack,
}: {
  initial: NetworkDevice[];
  onContinue: (devices: NetworkDevice[]) => void;
  onBack: () => void;
}) {
  const [devices, setDevices] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(initial.length > 0);

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setProgress('Preparing Wi-Fi scan…');
    try {
      const results = await scanLocalNetwork(p => {
        setProgress(
          `${Math.round((p.completed / p.total) * 100)}% · ${
            p.foundHosts
          } host(s) with a tested service`,
        );
      });
      setDevices(results);
      setProgress(
        results.length
          ? `Scan complete · ${results.length} device(s) need classification`
          : 'Scan complete · no tested camera-associated services found',
      );
    } catch (e) {
      setDevices([]);
      setProgress('');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Title>Wi-Fi sweep</Title>
        <Body>
          Sweeper checks a small set of common camera and embedded-device service
          ports on the private Wi-Fi network. It does not log in to anything or
          retrieve device content.
        </Body>

        <PrimaryButton
          title={attempted ? 'SCAN AGAIN' : 'START WI-FI SCAN'}
          onPress={scan}
          loading={loading}
        />

        {progress ? <Text style={styles.progress}>{progress}</Text> : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Wi-Fi scan unavailable</Text>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.simulatorNote}>
              If you are using the iOS Simulator, local-network results do not
              represent a real iPhone on the room's Wi-Fi. We will validate this
              step on a physical device.
            </Text>
          </Card>
        ) : null}

        {devices.map(device => (
          <Card key={device.ip}>
            <View style={styles.row}>
              <Subtitle>{device.ip}</Subtitle>
              <Text
                style={
                  device.suspicionScore >= 20 ? styles.flag : styles.ok
                }>
                {device.suspicionScore >= 20 ? 'REVIEW' : 'FOUND'}
              </Text>
            </View>
            <Body>Open tested ports: {device.openPorts.join(', ')}</Body>
            {device.reasons.map(reason => (
              <Text key={reason} style={styles.reason}>
                • {reason}
              </Text>
            ))}
          </Card>
        ))}

        {attempted && !loading && !error && devices.length === 0 ? (
          <Card>
            <Subtitle>No tested services found</Subtitle>
            <Body>
              Nothing matched the small service-port set in this pass. This is
              not a guarantee that the room is camera-free.
            </Body>
            <Text style={styles.simulatorNote}>
              This first-pass scan checks only a small service-port set. A
              device can be present without exposing one of these ports. Deeper
              Bonjour/mDNS and SSDP discovery is the next network milestone.
            </Text>
          </Card>
        ) : null}

        {!attempted ? (
          <Card>
            <Body>
              For development, the simulator can exercise this screen, but the
              meaningful network test is on a physical iPhone connected to the
              same Wi-Fi as the room's devices.
            </Body>
          </Card>
        ) : null}

        <PrimaryButton
          title="CONTINUE TO BLUETOOTH"
          onPress={() => onContinue(devices)}
          disabled={loading}
        />
        <SecondaryButton title="Back" onPress={onBack} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {paddingTop: 10, paddingBottom: 12},
  progress: {
    color: palette.accent,
    fontWeight: '700',
    marginVertical: 12,
  },
  errorCard: {marginTop: 12, borderColor: '#5b2a31'},
  errorTitle: {
    color: palette.danger,
    fontWeight: '800',
    marginBottom: 5,
  },
  error: {color: '#f1a0a0', lineHeight: 20},
  simulatorNote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flag: {color: palette.warning, fontWeight: '900', fontSize: 12},
  ok: {color: palette.accent, fontWeight: '900', fontSize: 12},
  reason: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
});
