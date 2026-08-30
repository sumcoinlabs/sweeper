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
import {scanBluetooth} from '../services/bluetoothScanner';
import type {BleDeviceFinding} from '../types';

function signalLabel(rssi: number | null) {
  if (rssi == null) return 'Unknown';
  if (rssi >= -50) return 'Very strong';
  if (rssi >= -65) return 'Strong';
  if (rssi >= -80) return 'Medium';
  return 'Weak';
}

export function BluetoothScreen({
  initial,
  onContinue,
  onBack,
}: {
  initial: BleDeviceFinding[];
  onContinue: (devices: BleDeviceFinding[]) => void;
  onBack: () => void;
}) {
  const [devices, setDevices] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(initial.length);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(initial.length > 0);

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setCount(0);
    try {
      const found = await scanBluetooth(undefined, setCount);
      setDevices(found);
    } catch (e) {
      setDevices([]);
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
        <Title>Bluetooth sweep</Title>
        <Body>
          Sweeper listens briefly for nearby Bluetooth Low Energy devices. Signal
          strength can suggest proximity, but it cannot prove what a device is.
        </Body>

        <PrimaryButton
          title={attempted ? 'SCAN AGAIN' : 'START BLUETOOTH SCAN'}
          onPress={scan}
          loading={loading}
        />

        {loading ? (
          <Text style={styles.progress}>
            Scanning… {count} unique device(s)
          </Text>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Bluetooth scan unavailable</Text>
            <Text style={styles.error}>{error}</Text>
          </Card>
        ) : null}

        {devices.map(device => (
          <Card key={device.id}>
            <View style={styles.row}>
              <Subtitle>{device.name || 'Unnamed BLE device'}</Subtitle>
              <Text
                style={
                  device.suspicionScore >= 10 ? styles.flag : styles.ok
                }>
                {device.suspicionScore >= 10
                  ? 'REVIEW'
                  : signalLabel(device.rssi)}
              </Text>
            </View>
            <Body>
              Signal: {device.rssi ?? 'n/a'} dBm · {signalLabel(device.rssi)}
            </Body>
            {device.serviceUUIDs.length ? (
              <Body>
                Services: {device.serviceUUIDs.slice(0, 4).join(', ')}
              </Body>
            ) : null}
            {device.reasons.map(reason => (
              <Text key={reason} style={styles.reason}>
                • {reason}
              </Text>
            ))}
          </Card>
        ))}

        {attempted && !loading && !error && devices.length === 0 ? (
          <Card>
            <Subtitle>Scan complete</Subtitle>
            <Body>
              No BLE advertisements were detected during this scan. That does
              not rule out a camera because many cameras do not advertise over
              Bluetooth.
            </Body>
          </Card>
        ) : null}

        {!attempted ? (
          <Card>
            <Body>
              The iOS Simulator cannot perform a real BLE sweep. Use a physical
              iPhone when we move from UI testing to hardware testing.
            </Body>
          </Card>
        ) : null}

        <PrimaryButton
          title="CONTINUE TO PHYSICAL CHECK"
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flag: {color: palette.warning, fontWeight: '900', fontSize: 12},
  ok: {color: palette.accent, fontWeight: '800', fontSize: 12},
  reason: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
});
