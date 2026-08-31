import React, {useMemo, useState} from 'react';
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

  const counts = useMemo(() => {
    const mdns = devices.filter(device =>
      device.discoverySources?.includes('mdns'),
    ).length;
    const tcp = devices.filter(device =>
      device.discoverySources?.includes('tcp'),
    ).length;
    const review = devices.filter(
      device => device.suspicionScore >= 20,
    ).length;

    return {mdns, tcp, review};
  }, [devices]);

  const scan = async () => {
    setLoading(true);
    setAttempted(true);
    setError('');
    setProgress('Starting TCP + Bonjour discovery…');

    try {
      const results = await scanLocalNetwork(p => {
        if (p.phase === 'mdns') {
          setProgress(
            `Bonjour ${p.completed}/${p.total} service types · ${p.foundServices} service(s) discovered`,
          );
        } else {
          setProgress(
            `TCP ${Math.round((p.completed / p.total) * 100)}% · ${p.foundHosts} discovered host(s)`,
          );
        }
      });

      setDevices(results);
      setProgress(
        `Complete · ${results.length} device(s) · ${results.filter(
          item => item.discoverySources?.includes('mdns'),
        ).length} via Bonjour`,
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
          Sweeper now combines safe TCP service checks with Bonjour/mDNS device
          discovery. It does not log in to devices, retrieve content, or treat a
          generic network device as proof of a camera.
        </Body>

        <PrimaryButton
          title={attempted ? 'SCAN AGAIN' : 'START WI-FI SCAN'}
          onPress={scan}
          loading={loading}
        />

        {progress ? <Text style={styles.progress}>{progress}</Text> : null}

        {attempted && !loading && !error ? (
          <Card>
            <View style={styles.metricRow}>
              <Text style={styles.metric}>Devices discovered</Text>
              <Text style={styles.value}>{devices.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metric}>Bonjour/mDNS devices</Text>
              <Text style={styles.value}>{counts.mdns}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metric}>TCP-responsive devices</Text>
              <Text style={styles.value}>{counts.tcp}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metric}>Devices to review</Text>
              <Text style={styles.value}>{counts.review}</Text>
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Wi-Fi scan unavailable</Text>
            <Text style={styles.error}>{error}</Text>
          </Card>
        ) : null}

        {devices.map((device, index) => (
          <Card key={`${device.ip}-${device.hostname || ''}-${index}`}>
            <View style={styles.row}>
              <View style={styles.titleArea}>
                <Subtitle>{device.hostname || device.ip}</Subtitle>
                {device.hostname ? <Body>{device.ip}</Body> : null}
              </View>
              <Text
                style={
                  device.suspicionScore >= 20 ? styles.flag : styles.ok
                }>
                {device.suspicionScore >= 20 ? 'REVIEW' : 'FOUND'}
              </Text>
            </View>

            {device.discoverySources?.length ? (
              <Text style={styles.source}>
                Found by: {device.discoverySources.join(' + ').toUpperCase()}
              </Text>
            ) : null}

            {device.openPorts.length ? (
              <Body>Open tested ports: {device.openPorts.join(', ')}</Body>
            ) : null}

            {device.bonjourServices?.length ? (
              <View style={styles.services}>
                {device.bonjourServices.map((service, serviceIndex) => (
                  <Text
                    key={`${service.type}-${service.name}-${serviceIndex}`}
                    style={styles.service}>
                    {service.type}
                    {service.name ? ` · ${service.name}` : ''}
                    {service.port ? ` · port ${service.port}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {device.reasons.map((reason, reasonIndex) => (
              <Text
                key={`${reasonIndex}-${reason}`}
                style={styles.reason}>
                • {reason}
              </Text>
            ))}
          </Card>
        ))}

        {attempted && !loading && !error && devices.length === 0 ? (
          <Card>
            <Subtitle>No devices discovered</Subtitle>
            <Body>
              This network did not expose one of the TCP or Bonjour services
              Sweeper currently checks. SSDP/UPnP discovery is the next network
              layer and may reveal devices that do not advertise over Bonjour.
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
  errorCard: {borderColor: '#5b2a31'},
  errorTitle: {
    color: palette.danger,
    fontWeight: '800',
    marginBottom: 5,
  },
  error: {color: '#f1a0a0', lineHeight: 20},
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  metric: {color: palette.muted, flex: 1},
  value: {color: palette.text, fontWeight: '900'},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleArea: {flex: 1},
  flag: {color: palette.warning, fontWeight: '900', fontSize: 12},
  ok: {color: palette.accent, fontWeight: '900', fontSize: 12},
  source: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4,
  },
  services: {marginTop: 7},
  service: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 3,
  },
  reason: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
});
