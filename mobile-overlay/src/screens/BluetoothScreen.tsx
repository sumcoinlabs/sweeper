import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Body,
  Card,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Subtitle,
  Title,
} from '../components/ui';
import {
  EvidenceMeter,
  ScanPulse,
  StatTile,
} from '../components/ScanVisual';
import {scanBluetooth} from '../services/bluetoothScanner';
import type {
  BleDeviceFinding,
  BleProximity,
} from '../types';

const BLE_SCAN_MS = 10000;

function proximityLabel(proximity: BleProximity): string {
  switch (proximity) {
    case 'very_close':
      return 'Very close';
    case 'nearby':
      return 'Nearby';
    case 'farther':
      return 'Farther away';
    default:
      return 'Distance unavailable';
  }
}

function evidenceLabel(device: BleDeviceFinding): string {
  switch (device.assessment.evidenceLevel) {
    case 'strong':
      return 'Strong camera/security clue';
    case 'moderate':
      return 'Camera/security clue';
    case 'weak':
      return 'Weak camera/security clue';
    default:
      return 'No camera-specific clue';
  }
}

function isRecognizedNormal(device: BleDeviceFinding): boolean {
  return device.assessment.evidenceCodes.some(code =>
    ['KNOWN_CONSUMER_DEVICE', 'KNOWN_SMART_HOME_SERVICE'].includes(code),
  );
}

function uniqueRecognizedLabels(devices: BleDeviceFinding[]): string[] {
  return [
    ...new Set(
      devices
        .filter(isRecognizedNormal)
        .map(device => device.assessment.userTitle)
        .filter(Boolean),
    ),
  ].slice(0, 8);
}

function buildExport(devices: BleDeviceFinding[]): string {
  const cautions = devices.filter(
    device => device.assessment.backendReview,
  );
  const recognized = uniqueRecognizedLabels(devices);
  const unclassified = devices.filter(
    device =>
      !device.assessment.backendReview &&
      !isRecognizedNormal(device),
  ).length;

  const lines = [
    'SWEEPER BLUETOOTH FINDINGS',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Bluetooth advertisers heard: ${devices.length}`,
    `Camera/security cautions: ${cautions.length}`,
    `Recognized common device types: ${recognized.length}`,
    `Other/unclassified advertisers: ${unclassified}`,
    '',
    recognized.length
      ? `Recognized nearby: ${recognized.join(', ')}`
      : 'Recognized nearby: none',
    '',
    'IMPORTANT',
    'Bluetooth scanning detects nearby BLE peripherals that are advertising during the scan. It cannot guarantee detection of every physical Bluetooth device, and Bluetooth evidence alone does not prove a hidden camera.',
  ];

  cautions.forEach((device, index) => {
    lines.push(
      '',
      `FINDING ${index + 1}`,
      device.assessment.userTitle,
      `Evidence: ${evidenceLabel(device)}`,
      `Approximate proximity: ${proximityLabel(device.proximity)}`,
      device.assessment.userSummary,
      `Evidence codes: ${
        device.assessment.evidenceCodes.join(', ') || 'none'
      }`,
      '',
      'Technical evidence for support/backend review:',
      `Samples: ${device.sightings}`,
      `Median RSSI: ${device.rssi ?? 'n/a'}`,
      `Average RSSI: ${device.averageRssi ?? 'n/a'}`,
      `Strongest valid RSSI: ${device.strongestRssi ?? 'n/a'}`,
      `Service UUIDs: ${device.serviceUUIDs.join(', ') || 'none'}`,
      `Service-data UUIDs: ${device.serviceDataUUIDs.join(', ') || 'none'}`,
      `Manufacturer company ID: ${device.manufacturerCompanyId || 'unknown'}`,
    );
  });

  return lines.join('\n');
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
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    if (!loading) {
      setScanProgress(0);
      return;
    }

    const started = Date.now();
    setScanProgress(0.02);

    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      setScanProgress(Math.min(0.98, elapsed / BLE_SCAN_MS));
    }, 150);

    return () => clearInterval(timer);
  }, [loading]);

  const cautions = useMemo(
    () => devices.filter(device => device.assessment.backendReview),
    [devices],
  );

  const recognizedLabels = useMemo(
    () => uniqueRecognizedLabels(devices),
    [devices],
  );

  const recognizedCount = useMemo(
    () => devices.filter(isRecognizedNormal).length,
    [devices],
  );

  const unclassifiedCount = useMemo(
    () =>
      devices.filter(
        device =>
          !device.assessment.backendReview &&
          !isRecognizedNormal(device),
      ).length,
    [devices],
  );

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setCount(0);

    try {
      const found = await scanBluetooth(BLE_SCAN_MS, setCount);
      setDevices(found);
    } catch (e) {
      setDevices([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const exportFindings = async () => {
    try {
      await Share.share({
        title: 'Sweeper Bluetooth findings',
        message: buildExport(devices),
      });
    } catch (e) {
      Alert.alert(
        'Could not export findings',
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Title>Bluetooth check</Title>

        <Body>
          Sweeper listens for nearby Bluetooth advertisers and checks the
          identity they choose to broadcast for camera or security clues.
        </Body>

        <PrimaryButton
          title={attempted ? 'CHECK AGAIN' : 'CHECK BLUETOOTH'}
          onPress={scan}
          loading={loading}
        />

        {loading ? (
          <>
            <ScanPulse
              title="Listening for nearby devices"
              subtitle="Walk slowly around the room while the beacon pulses. Sweeper is listening in every direction; it does not pretend to know a compass direction."
              countText={`${count} advertiser${count === 1 ? '' : 's'} heard`}
              progress={scanProgress}
              primary="#58D6C0"
              secondary="#5AA8FF"
              tertiary="#A984FF"
            />

            <View style={styles.tipStrip}>
              <Text style={styles.tipDot}>●</Text>
              <Text style={styles.tipText}>
                Best coverage: move near the bed, bathroom, TV area,
                chargers, clocks and smoke detectors while the scan runs.
              </Text>
            </View>
          </>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Subtitle>Bluetooth check unavailable</Subtitle>
            <Body>{error}</Body>
          </Card>
        ) : null}

        {attempted && !loading && !error ? (
          <>
            <Card
              style={
                cautions.length > 0
                  ? styles.cautionSummary
                  : styles.clearSummary
              }>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusOrb,
                    cautions.length > 0
                      ? styles.statusOrbCaution
                      : styles.statusOrbClear,
                  ]}>
                  <Text style={styles.statusSymbol}>
                    {cautions.length > 0 ? '!' : '✓'}
                  </Text>
                </View>

                <View style={styles.statusCopy}>
                  <Text
                    style={
                      cautions.length > 0
                        ? styles.cautionHeading
                        : styles.clearHeading
                    }>
                    {cautions.length > 0
                      ? `${cautions.length} Bluetooth caution${
                          cautions.length === 1 ? '' : 's'
                        }`
                      : 'No camera-specific Bluetooth clues'}
                  </Text>

                  <Text style={styles.context}>
                    {cautions.length > 0
                      ? 'Sweeper recognized Bluetooth information associated with camera or security equipment.'
                      : 'No advertiser matched a camera/security fingerprint during this scan.'}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.stats}>
              <StatTile
                value={devices.length}
                label="advertisers heard"
                accent="#5AA8FF"
              />
              <StatTile
                value={recognizedCount}
                label="recognized devices"
                accent="#58D6C0"
              />
              <StatTile
                value={unclassifiedCount}
                label="anonymous / other"
                accent="#A984FF"
              />
            </View>

            {cautions.length === 0 ? (
              <Card style={styles.recognizedCard}>
                <Subtitle>What Sweeper recognized</Subtitle>

                {recognizedLabels.length > 0 ? (
                  <>
                    <Body>
                      These common device types were identified without
                      creating a camera warning:
                    </Body>

                    <View style={styles.chips}>
                      {recognizedLabels.map((label, index) => (
                        <View
                          key={label}
                          style={[
                            styles.chip,
                            index % 3 === 0
                              ? styles.chipBlue
                              : index % 3 === 1
                                ? styles.chipTeal
                                : styles.chipPurple,
                          ]}>
                          <Text style={styles.chipText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <Body>
                    No common device identity was confidently recognized
                    in this scan.
                  </Body>
                )}

                {unclassifiedCount > 0 ? (
                  <View style={styles.anonymousBox}>
                    <Text style={styles.simpleTitle}>
                      {unclassifiedCount} advertiser
                      {unclassifiedCount === 1 ? '' : 's'} stayed anonymous
                    </Text>
                    <Body>
                      That is normal. Many Bluetooth devices intentionally
                      broadcast little or no readable identity. Sweeper does
                      not turn anonymity or a strong signal into a threat.
                    </Body>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {cautions.map((device, index) => (
              <Card
                key={`ble-caution-${device.id}-${index}`}
                style={styles.cautionCard}>
                <Text style={styles.cautionLabel}>BLUETOOTH CAUTION</Text>

                <Subtitle>{device.assessment.userTitle}</Subtitle>

                <EvidenceMeter
                  level={device.assessment.evidenceLevel}
                  label={evidenceLabel(device)}
                />

                <View style={styles.proximityRow}>
                  <Text style={styles.proximityLabel}>
                    Approximate proximity
                  </Text>
                  <Text style={styles.proximityValue}>
                    {proximityLabel(device.proximity)}
                  </Text>
                </View>

                <Body>{device.assessment.userSummary}</Body>

                <View style={styles.actionBox}>
                  <Text style={styles.actionTitle}>Follow the clue</Text>
                  <Body>
                    Move around the room and check again. If this same
                    camera/security clue repeatedly becomes very close near
                    one object, inspect that object during the physical and
                    lens checks.
                  </Body>
                </View>
              </Card>
            ))}

            <Card style={styles.limitCard}>
              <Text style={styles.limitTitle}>
                What this scan can and cannot see
              </Text>
              <Body>
                Sweeper listens for Bluetooth Low Energy devices that are
                advertising while this scan is running. A device that is not
                advertising can remain invisible, which is why Bluetooth is
                only one layer of the full sweep.
              </Body>
            </Card>

            {devices.length > 0 ? (
              <SecondaryButton
                title="EXPORT FINDINGS"
                onPress={exportFindings}
              />
            ) : null}
          </>
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
  errorCard: {borderColor: '#5b2a31'},
  tipStrip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    backgroundColor: '#151728',
    borderWidth: 1,
    borderColor: '#36305A',
  },
  tipDot: {color: '#A984FF', fontSize: 12, marginTop: 2},
  tipText: {
    color: '#B4B7D0',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  cautionSummary: {
    borderColor: '#FFB84D',
    backgroundColor: '#211B18',
  },
  clearSummary: {
    borderColor: '#58D6C0',
    backgroundColor: '#101D22',
  },
  statusRow: {flexDirection: 'row', gap: 14, alignItems: 'center'},
  statusOrb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  statusOrbClear: {
    borderColor: '#58D6C0',
    backgroundColor: '#12312C',
  },
  statusOrbCaution: {
    borderColor: '#FFB84D',
    backgroundColor: '#3A2916',
  },
  statusSymbol: {color: '#F6F8FB', fontSize: 28, fontWeight: '900'},
  statusCopy: {flex: 1},
  cautionHeading: {color: '#FFB84D', fontSize: 22, fontWeight: '900'},
  clearHeading: {color: '#58D6C0', fontSize: 22, fontWeight: '900'},
  context: {
    color: '#A6B3C4',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginVertical: 12,
  },
  recognizedCard: {
    backgroundColor: '#111A29',
    borderColor: '#2C405A',
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  chip: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipBlue: {backgroundColor: '#12253A', borderColor: '#345D89'},
  chipTeal: {backgroundColor: '#12302D', borderColor: '#2E675F'},
  chipPurple: {backgroundColor: '#211D36', borderColor: '#55477C'},
  chipText: {color: '#F6F8FB', fontSize: 13, fontWeight: '800'},
  anonymousBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#171729',
  },
  simpleTitle: {color: '#F6F8FB', fontWeight: '900', marginBottom: 4},
  cautionCard: {
    borderColor: '#FFB84D',
    backgroundColor: '#1D1A18',
  },
  cautionLabel: {
    color: '#FFB84D',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  proximityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 14,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#151A27',
  },
  proximityLabel: {color: '#A6B3C4', fontSize: 13},
  proximityValue: {color: '#5AA8FF', fontSize: 13, fontWeight: '900'},
  actionBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3A3A43',
  },
  actionTitle: {color: '#58D6C0', fontWeight: '900', marginBottom: 3},
  limitCard: {backgroundColor: '#151728', borderColor: '#36305A'},
  limitTitle: {color: '#C7B8FF', fontWeight: '900', marginBottom: 5},
});
