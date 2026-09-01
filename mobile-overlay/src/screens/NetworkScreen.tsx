import React, {useMemo, useState} from 'react';
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
  palette,
} from '../components/ui';
import {scanLocalNetwork} from '../services/networkScanner';
import type {NetworkAssessment, NetworkDevice} from '../types';

function isIpv4(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function assessmentFor(
  device: NetworkDevice,
): NetworkAssessment {
  if (device.assessment) return device.assessment;

  const confirmedRtsp = device.fingerprints?.some(
    fingerprint =>
      fingerprint.protocol === 'rtsp' &&
      fingerprint.confirmed,
  );

  if (confirmedRtsp) {
    return {
      category: 'network_video',
      evidenceLevel: 'strong',
      userTitle: 'Possible IP camera or video recorder',
      userSummary:
        'This device responded to a standard network video-streaming protocol. That is strong evidence of network video equipment, but Wi-Fi alone cannot tell whether it is hidden or improperly placed.',
      backendReview: true,
      networkOnlyThreatEligible: false,
      evidenceCodes: ['RTSP_CONFIRMED'],
    };
  }

  return {
    category: 'other',
    evidenceLevel: 'none',
    userTitle: 'Other network device',
    userSummary:
      'Sweeper found this device but did not find camera-specific evidence.',
    backendReview: false,
    networkOnlyThreatEligible: false,
    evidenceCodes: [],
  };
}

function confidenceLabel(
  assessment: NetworkAssessment,
): string {
  switch (assessment.evidenceLevel) {
    case 'strong':
      return 'Strong camera/video signal';
    case 'moderate':
      return 'Camera-related signal';
    case 'weak':
      return 'Weak signal';
    default:
      return 'No camera-specific signal';
  }
}

function buildExport(
  devices: NetworkDevice[],
): string {
  const ipv4Devices = devices.filter(device => isIpv4(device.ip));
  const cautions = devices.filter(
    device => assessmentFor(device).backendReview,
  );

  const lines = [
    'SWEEPER WI-FI FINDINGS',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Network devices checked: ${ipv4Devices.length || devices.length}`,
    `Camera/video signals: ${cautions.length}`,
    '',
    'IMPORTANT',
    'A network camera/video signal does not prove a hidden camera or an improper recording device. Physical context and additional evidence are required before reporting a property as a threat.',
  ];

  cautions.forEach((device, index) => {
    const assessment = assessmentFor(device);

    lines.push(
      '',
      `FINDING ${index + 1}`,
      assessment.userTitle,
      `Evidence strength: ${confidenceLabel(assessment)}`,
      assessment.userSummary,
      `Evidence codes: ${
        assessment.evidenceCodes.join(', ') || 'none'
      }`,
      '',
      'Technical evidence for support/backend review:',
      `Address: ${device.ip}`,
      `Open tested ports: ${
        device.openPorts.join(', ') || 'none'
      }`,
      `Detected by: ${
        device.discoverySources?.join(', ') || 'unknown'
      }`,
    );

    device.fingerprints?.forEach(fingerprint => {
      lines.push(
        `${fingerprint.protocol.toUpperCase()} ${fingerprint.port}: ${fingerprint.summary}`,
      );
    });
  });

  return lines.join('\n');
}

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

  const cautions = useMemo(
    () =>
      devices.filter(
        device => assessmentFor(device).backendReview,
      ),
    [devices],
  );

  const checkedCount = useMemo(() => {
    const ipv4 = devices.filter(device => isIpv4(device.ip)).length;
    return ipv4 || devices.length;
  }, [devices]);

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setProgress('Checking this Wi-Fi…');

    try {
      const results = await scanLocalNetwork(p => {
        if (p.phase === 'icmp') {
          setProgress('Finding devices on this Wi-Fi…');
        } else if (p.phase === 'tcp') {
          setProgress('Checking for camera/video signals…');
        } else if (p.phase === 'fingerprint') {
          setProgress('Identifying possible camera equipment…');
        }
      });

      setDevices(results);

      const reviewCount = results.filter(
        device => assessmentFor(device).backendReview,
      ).length;

      setProgress(
        reviewCount > 0
          ? `Complete · ${reviewCount} camera/video signal${
              reviewCount === 1 ? '' : 's'
            } found`
          : 'Complete · no camera-specific Wi-Fi signals found',
      );
    } catch (e) {
      setDevices([]);
      setProgress('');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const exportFindings = async () => {
    try {
      await Share.share({
        title: 'Sweeper Wi-Fi findings',
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
        <Title>Wi-Fi check</Title>
        <Body>
          Sweeper looks for network behavior commonly associated with
          cameras and video-security equipment.
        </Body>

        <PrimaryButton
          title={attempted ? 'CHECK AGAIN' : 'CHECK WI-FI'}
          onPress={scan}
          loading={loading}
        />

        {progress ? (
          <Text style={styles.progress}>{progress}</Text>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Subtitle>Wi-Fi check unavailable</Subtitle>
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
              <Text
                style={
                  cautions.length > 0
                    ? styles.cautionHeading
                    : styles.clearHeading
                }>
                {cautions.length > 0
                  ? `${cautions.length} camera/video signal${
                      cautions.length === 1 ? '' : 's'
                    } found`
                  : 'No camera-specific Wi-Fi signals found'}
              </Text>

              <Body>
                Sweeper checked {checkedCount} network device
                {checkedCount === 1 ? '' : 's'}.
              </Body>

              <Text style={styles.notVerdict}>
                {cautions.length > 0
                  ? 'This is a caution, not a hidden-camera finding.'
                  : 'Wi-Fi cannot detect every kind of camera. Continue the sweep.'}
              </Text>
            </Card>

            {cautions.map((device, index) => {
              const assessment = assessmentFor(device);

              return (
                <Card
                  key={`caution-${device.ip}-${index}`}
                  style={styles.cautionCard}>
                  <Text style={styles.cautionLabel}>
                    CAMERA/VIDEO SIGNAL
                  </Text>

                  <Subtitle>{assessment.userTitle}</Subtitle>

                  <Text style={styles.confidence}>
                    {confidenceLabel(assessment)}
                  </Text>

                  <Body>{assessment.userSummary}</Body>

                  <View style={styles.simpleExplanation}>
                    <Text style={styles.simpleTitle}>
                      What this could be
                    </Text>
                    <Body>
                      An IP security camera, doorbell camera, baby monitor,
                      network video recorder, or another device that streams
                      video over the local network.
                    </Body>
                  </View>

                  <View style={styles.simpleExplanation}>
                    <Text style={styles.simpleTitle}>
                      What Sweeper cannot tell yet
                    </Text>
                    <Body>
                      Wi-Fi cannot tell where the device is located, whether it
                      is hidden, or whether its presence is improper.
                    </Body>
                  </View>

                  <View style={styles.actionBox}>
                    <Text style={styles.actionTitle}>Next step</Text>
                    <Body>
                      Continue the Bluetooth, lens and physical checks. If you
                      find a suspicious object, document it with a photo before
                      considering a report.
                    </Body>
                  </View>
                </Card>
              );
            })}

            <Card style={styles.reportRule}>
              <Text style={styles.reportRuleTitle}>
                Do not report a property from Wi-Fi alone
              </Text>
              <Body>
                Sweeper should only treat something as a possible hidden-camera
                report when multiple pieces of evidence support it, such as a
                strong camera/video signal plus a suspicious physical finding
                or photo. Network evidence by itself is saved for analysis but
                is not enough to accuse a property.
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
  content: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  progress: {
    color: palette.accent,
    fontWeight: '800',
    marginVertical: 12,
  },
  errorCard: {
    borderColor: '#5b2a31',
  },
  cautionSummary: {
    borderColor: palette.warning,
  },
  clearSummary: {
    borderColor: palette.accent,
  },
  cautionHeading: {
    color: palette.warning,
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 8,
  },
  clearHeading: {
    color: palette.accent,
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 8,
  },
  notVerdict: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: '700',
  },
  cautionCard: {
    borderColor: palette.warning,
  },
  cautionLabel: {
    color: palette.warning,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  confidence: {
    color: palette.warning,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 8,
  },
  simpleExplanation: {
    marginTop: 12,
  },
  simpleTitle: {
    color: palette.text,
    fontWeight: '900',
    marginBottom: 2,
  },
  actionBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  actionTitle: {
    color: palette.accent,
    fontWeight: '900',
    marginBottom: 3,
  },
  reportRule: {
    borderColor: palette.border,
  },
  reportRuleTitle: {
    color: palette.text,
    fontWeight: '900',
    marginBottom: 5,
  },
});
