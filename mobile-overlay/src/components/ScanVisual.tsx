import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';

type EvidenceLevel = 'none' | 'weak' | 'moderate' | 'strong';

export function ScanPulse({
  title,
  subtitle,
  countText,
  progress = 0,
  primary = '#58D6C0',
  secondary = '#5AA8FF',
  tertiary = '#A984FF',
}: {
  title: string;
  subtitle: string;
  countText?: string;
  progress?: number;
  primary?: string;
  secondary?: string;
  tertiary?: string;
}) {
  const pulseOne = useRef(new Animated.Value(0)).current;
  const pulseTwo = useRef(new Animated.Value(0)).current;
  const core = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const first = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOne, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(250),
        Animated.timing(pulseOne, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const second = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(pulseTwo, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(250),
        Animated.timing(pulseTwo, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const center = Animated.loop(
      Animated.sequence([
        Animated.timing(core, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(core, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    first.start();
    second.start();
    center.start();

    return () => {
      first.stop();
      second.stop();
      center.stop();
    };
  }, [core, pulseOne, pulseTwo]);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0.5, 0.42, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.62, 1.42],
        }),
      },
    ],
  });

  const coreStyle = {
    transform: [
      {
        scale: core.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.08],
        }),
      },
    ],
  };

  const safeProgress = Math.max(0.03, Math.min(1, progress));
  const progressWidth = `${Math.round(safeProgress * 100)}%` as `${number}%`;

  return (
    <View style={styles.shell}>
      <View style={styles.orb}>
        <Animated.View
          style={[
            styles.ring,
            {borderColor: secondary},
            ringStyle(pulseOne),
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            styles.ringSmall,
            {borderColor: tertiary},
            ringStyle(pulseTwo),
          ]}
        />
        <Animated.View
          style={[
            styles.core,
            {backgroundColor: primary},
            coreStyle,
          ]}>
          <View
            style={[
              styles.coreDot,
              {backgroundColor: secondary},
            ]}
          />
        </Animated.View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {countText ? (
        <Text style={[styles.count, {color: primary}]}>
          {countText}
        </Text>
      ) : null}

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: progressWidth,
              backgroundColor: secondary,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function EvidenceMeter({
  level,
  label,
}: {
  level: EvidenceLevel;
  label?: string;
}) {
  const activeCount =
    level === 'strong'
      ? 3
      : level === 'moderate'
        ? 2
        : level === 'weak'
          ? 1
          : 0;

  const automaticLabel =
    level === 'strong'
      ? 'Strong device evidence'
      : level === 'moderate'
        ? 'Camera/security clue'
        : level === 'weak'
          ? 'Weak clue'
          : 'No camera-specific evidence';

  const colors = ['#5AA8FF', '#A984FF', '#FFB84D'];

  return (
    <View style={styles.meter}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>Evidence strength</Text>
        <Text style={styles.meterValue}>
          {label || automaticLabel}
        </Text>
      </View>

      <View style={styles.meterBars}>
        {colors.map((color, index) => (
          <View
            key={color}
            style={[
              styles.meterBar,
              {
                backgroundColor:
                  index < activeCount ? color : '#263442',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.meterLegend}>
        <Text style={styles.legendText}>clue</Text>
        <Text style={styles.legendText}>camera-related</Text>
        <Text style={styles.legendText}>strong</Text>
      </View>
    </View>
  );
}

export function StatTile({
  value,
  label,
  accent = '#5AA8FF',
}: {
  value: string | number;
  label: string;
  accent?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, {color: accent}]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 24,
    backgroundColor: '#111B2A',
    borderWidth: 1,
    borderColor: '#273A52',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orb: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 3,
  },
  ringSmall: {
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#58D6C0',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 0},
  },
  coreDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  title: {
    color: '#F6F8FB',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#A6B3C4',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  count: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#263442',
    overflow: 'hidden',
    width: '100%',
    marginTop: 18,
  },
  progressFill: {
    height: 7,
    borderRadius: 4,
  },
  meter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A394A',
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 9,
  },
  meterLabel: {
    color: '#A6B3C4',
    fontSize: 13,
    fontWeight: '700',
  },
  meterValue: {
    color: '#F6F8FB',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
  },
  meterBars: {
    flexDirection: 'row',
    gap: 7,
  },
  meterBar: {
    flex: 1,
    height: 9,
    borderRadius: 5,
  },
  meterLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  legendText: {
    color: '#708095',
    fontSize: 10,
  },
  statTile: {
    flex: 1,
    minWidth: 92,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#101A28',
    borderWidth: 1,
    borderColor: '#26394D',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: '#A6B3C4',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
});
