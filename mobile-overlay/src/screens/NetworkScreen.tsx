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
} from '../components/ui';
import {
  EvidenceMeter,
  ScanPulse,
  StatTile,
} from '../components/ScanVisual';
import {scanLocalNetwork} from '../services/networkScanner';
import type {NetworkAssessment, NetworkDevice} from '../types';

function isIpv4(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function assessmentFor(device: NetworkDevice): NetworkAssessment {
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

function confidenceLabel(assessment: NetworkAssessment): string {
  switch (assessment.evidenceLevel) {
    case 'strong':
      return 'Strong network-video evidence';
    case 'moderate':
      return 'Camera-related network clue';
    case 'weak':
      return 'Weak network clue';
    default:
      return 'No camera-specific evidence';
  }
}

function buildExport(devices: NetworkDevice[]): string {
  const ipv4Devices = devices.filter(device => isIpv4(device.ip));
  const cautions = devices.filter(
    device => assessmentFor(device).backendReview,
  );

  const lines = [
    'SWEEPER WI-FI FINDINGS',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Network hosts discovered: ${ipv4Devices.length || devices.length}`,
    `Camera/video findings: ${cautions.length}`,
    '',
    'IMPORTANT',
    'A network camera/video finding does not prove a hidden camera or improper recording. Physical context and additional evidence are required before reporting a property as a threat.',
  ];

  cautions.forEach((device, index) => {
    const assessment = assessmentFor(device);

    lines.push(
      '',
      `FINDING ${index + 1}`,
      assessment.userTitle,
      `Evidence strength: ${confidenceLabel(assessment)}`,
      assessment.userSummary,
      `Evidence codes: ${assessment.evidenceCodes.join(', ') || 'none'}`,
      '',
      'Technical evidence for support/backend review:',
      `Address: ${device.ip}`,
      `Open tested ports: ${device.openPorts.join(', ') || 'none'}`,
      `Detected by: ${device.discoverySources?.join(', ') || 'unknown'}`,
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
  const [progressText, setProgressText] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(initial.length > 0);

  const cautions = useMemo(
    () => devices.filter(device => assessmentFor(device).backendReview),
    [devices],
  );

  const checkedCount = useMemo(() => {
    const ipv4 = devices.filter(device => isIpv4(device.ip)).length;
    return ipv4 || devices.length;
  }, [devices]);

  const strongCount = useMemo(
    () =>
      cautions.filter(
        device => assessmentFor(device).evidenceLevel === 'strong',
      ).length,
    [cautions],
  );

  const stageTitle =
    scanStage === 0
      ? 'Finding devices on this Wi-Fi'
      : scanStage === 1
        ? 'Checking camera/video services'
        : 'Confirming video behavior';

  const stageSubtitle =
    scanStage === 0
      ? 'Sweeper is looking for active local devices and advertised services.'
      : scanStage === 1
        ? 'Each discovered host is checked for services commonly used by cameras and video equipment.'
        : 'Promising signals are tested to distinguish real video protocols from ordinary network services.';

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setScanStage(0);
    setScanProgress(0.05);
    setLiveCount(0);
    setProgressText('Starting Wi-Fi sweep…');

    try {
      const results = await scanLocalNetwork(p => {
        if (p.phase === 'icmp') {
          setScanStage(0);
          setLiveCount(Math.max(p.foundHosts, p.foundServices));
          setScanProgress(p.completed ? 0.28 : 0.08);
          setProgressText('Discovering active devices…');
        } else if (p.phase === 'tcp') {
          setScanStage(1);
          setLiveCount(p.foundHosts);
          const ratio = p.total > 0 ? p.completed / p.total : 0;
          setScanProgress(0.3 + ratio * 0.48);
          setProgressText('Checking common camera/video services…');
        } else if (p.phase === 'fingerprint') {
          setScanStage(2);
          const ratio = p.total > 0 ? p.completed / p.total : 0;
          setScanProgress(0.8 + ratio * 0.19);
          setProgressText('Confirming camera/video protocols…');
        }
      });

      setDevices(results);
      setScanProgress(1);

      const reviewCount = results.filter(
        device => assessmentFor(device).backendReview,
      ).length;

      setProgressText(
        reviewCount > 0
          ? `Complete · ${reviewCount} camera/video finding${
              reviewCount === 1 ? '' : 's'
            }`
          : 'Complete · no camera-specific Wi-Fi findings',
      );
    } catch (e) {
      setDevices([]);
      setProgressText('');
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
          Sweeper checks the local network for devices and behavior commonly
          associated with cameras and video-security equipment.
        </Body>

        <PrimaryButton
          title={attempted ? 'CHECK AGAIN' : 'CHECK WI-FI'}
          onPress={scan}
          loading={loading}
        />

        {loading ? (
          <>
            <ScanPulse
              title={stageTitle}
              subtitle={stageSubtitle}
              countText={
                liveCount > 0
                  ? `${liveCount} device${liveCount === 1 ? '' : 's'} discovered so far`
                  : 'Building a picture of this network'
              }
              progress={scanProgress}
              primary="#58D6C0"
              secondary="#5AA8FF"
              tertiary="#A984FF"
            />

            <View style={styles.stageRow}>
              {['Discover', 'Check services', 'Confirm video'].map(
                (label, index) => (
                  <View
                    key={label}
                    style={[
                      styles.stagePill,
                      index < scanStage
                        ? styles.stageDone
                        : index === scanStage
                          ? styles.stageActive
                          : styles.stagePending,
                    ]}>
                    <Text
                      style={[
                        styles.stageText,
                        index === scanStage ? styles.stageTextActive : null,
                      ]}>
                      {index < scanStage ? '✓ ' : ''}
                      {label}
                    </Text>
                  </View>
                ),
              )}
            </View>

            {progressText ? (
              <Text style={styles.progressText}>{progressText}</Text>
            ) : null}
          </>
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
                      ? `${cautions.length} possible camera/video device${
                          cautions.length === 1 ? '' : 's'
                        }`
                      : 'No camera-specific Wi-Fi findings'}
                  </Text>

                  <Text style={styles.context}>
                    {cautions.length > 0
                      ? 'Sweeper found network behavior that deserves a closer physical check.'
                      : 'No discovered device produced camera-specific network evidence in this pass.'}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.stats}>
              <StatTile
                value={checkedCount}
                label="network devices discovered"
                accent="#5AA8FF"
              />
              <StatTile
                value={cautions.length}
                label="camera/video findings"
                accent={cautions.length > 0 ? '#FFB84D' : '#58D6C0'}
              />
              <StatTile
                value={strongCount}
                label="strong video matches"
                accent={strongCount > 0 ? '#A984FF' : '#708095'}
              />
            </View>

            {cautions.map((device, index) => {
              const assessment = assessmentFor(device);

              return (
                <Card
                  key={`wifi-caution-${device.ip}-${index}`}
                  style={styles.cautionCard}>
                  <Text style={styles.cautionLabel}>NETWORK VIDEO FINDING</Text>

                  <Subtitle>{assessment.userTitle}</Subtitle>

                  <EvidenceMeter
                    level={assessment.evidenceLevel}
                    label={confidenceLabel(assessment)}
                  />

                  <View style={styles.simpleSection}>
                    <Text style={styles.simpleTitle}>
                      What Sweeper actually observed
                    </Text>
                    <Body>{assessment.userSummary}</Body>
                  </View>

                  <View style={styles.typesBox}>
                    <Text style={styles.simpleTitle}>
                      Devices that can behave this way
                    </Text>
                    <Text style={styles.typeText}>
                      IP security camera · doorbell camera · baby monitor ·
                      DVR/NVR · other network video equipment
                    </Text>
                  </View>

                  <View style={styles.actionBox}>
                    <Text style={styles.actionTitle}>What to do next</Text>
                    <Body>
                      Continue the Bluetooth, lens and physical checks. Wi-Fi
                      can identify network-video behavior, but it cannot tell
                      whether the device is hidden or where it is located.
                    </Body>
                  </View>
                </Card>
              );
            })}

            <Card style={styles.coverageCard}>
              <Text style={styles.coverageTitle}>
                Why another sweep layer still matters
              </Text>
              <Body>
                Some network devices intentionally ignore discovery or expose
                no camera-specific service. Sweeper combines Wi-Fi with
                Bluetooth and physical/lens inspection instead of declaring a
                room safe from one technology alone.
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
  content: {paddingTop: 10, paddingBottom: 12},
  progressText: {
    color: '#58D6C0',
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 10,
  },
  stageRow: {flexDirection: 'row', gap: 7, marginTop: 10},
  stagePill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  stageDone: {backgroundColor: '#12302D', borderColor: '#2E675F'},
  stageActive: {backgroundColor: '#12253A', borderColor: '#5AA8FF'},
  stagePending: {backgroundColor: '#151A22', borderColor: '#293745'},
  stageText: {
    color: '#8391A3',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  stageTextActive: {color: '#D8E8FF'},
  errorCard: {borderColor: '#5b2a31'},
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
  simpleSection: {marginTop: 14},
  simpleTitle: {color: '#F6F8FB', fontWeight: '900', marginBottom: 4},
  typesBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#171729',
    borderWidth: 1,
    borderColor: '#36305A',
  },
  typeText: {
    color: '#C7B8FF',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  actionBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3A3A43',
  },
  actionTitle: {color: '#58D6C0', fontWeight: '900', marginBottom: 3},
  coverageCard: {backgroundColor: '#111A29', borderColor: '#2C405A'},
  coverageTitle: {color: '#9DC8FF', fontWeight: '900', marginBottom: 5},
});
