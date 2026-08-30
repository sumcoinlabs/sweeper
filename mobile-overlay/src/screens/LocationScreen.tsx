import React, {useEffect, useMemo, useState} from 'react';
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
import {detectLocation} from '../services/location';
import type {LocationInfo} from '../types';

export function LocationScreen({
  initial,
  onContinue,
  onBack,
}: {
  initial: LocationInfo | null;
  onContinue: (location: LocationInfo) => void;
  onBack: () => void;
}) {
  const [location, setLocation] = useState<LocationInfo | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');

  const area = useMemo(() => {
    if (!location) return '';
    return [location.locality, location.administrativeArea, location.country]
      .filter(Boolean)
      .join(', ');
  }, [location]);

  const capture = async () => {
    setLoading(true);
    setError('');
    try {
      const found = await detectLocation();
      // Property identity is GPS-driven. No manual property/address entry.
      setLocation({...found, name: '', address: ''});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to get your location.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial) {
      void capture();
    }
    // Capture only on first entry. Refresh is explicit after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View>
          <Title>Confirm your location</Title>
          <Body>
            Sweeper uses the phone's GPS to tag this sweep. There is no manual
            address entry, so reports are based on where the device actually is.
          </Body>
        </View>

        {loading ? (
          <Card style={styles.statusCard}>
            <Subtitle>Getting GPS location…</Subtitle>
            <Body>This normally takes only a few seconds.</Body>
          </Card>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Location unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {location ? (
          <Card style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Subtitle>GPS locked</Subtitle>
              <Text style={styles.ready}>READY</Text>
            </View>
            {area ? <Text style={styles.area}>{area}</Text> : null}
            <Text style={styles.coords}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
            {location.accuracy ? (
              <Body>Accuracy about {Math.round(location.accuracy)} m</Body>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            title="CONTINUE"
            onPress={() => location && onContinue(location)}
            disabled={!location || loading}
          />
          <SecondaryButton
            title={location ? 'Refresh GPS' : 'Try GPS again'}
            onPress={capture}
          />
          <SecondaryButton title="Back" onPress={onBack} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flexGrow: 1, paddingTop: 10, paddingBottom: 12},
  statusCard: {marginTop: 18},
  errorBox: {
    backgroundColor: '#24171a',
    borderColor: '#5b2a31',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  errorTitle: {
    color: palette.danger,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {color: '#f1a0a0', fontSize: 13, lineHeight: 19},
  locationCard: {marginTop: 18},
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ready: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  area: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  coords: {color: palette.muted, fontSize: 14, marginBottom: 5},
  actions: {marginTop: 'auto', paddingTop: 18},
});
