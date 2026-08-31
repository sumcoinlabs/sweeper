import React, {type PropsWithChildren} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export const palette = {
  bg: '#0b1016',
  panel: '#131b24',
  panel2: '#192430',
  text: '#f5f7fa',
  muted: '#98a6b5',
  accent: '#55d6be',
  warning: '#f4b860',
  danger: '#ff6b6b',
  border: '#263442',
};

export function Screen({children}: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.screen}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({children, style}: PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({children}: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({children}: PropsWithChildren) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({children}: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({pressed}) => [
        styles.primaryButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator color="#08110f" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({title, onPress}: {title: string; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.secondaryButton, pressed && styles.pressed]}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function RiskPill({score, label}: {score: number; label: string}) {
  const style = score >= 50 ? styles.riskHigh : score >= 25 ? styles.riskMedium : score >= 10 ? styles.riskLow : styles.riskClean;
  return (
    <View style={[styles.riskPill, style]}>
      <Text style={styles.riskText}>{label.toUpperCase()} · {score}/100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: palette.bg},
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    backgroundColor: palette.bg,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  title: {fontSize: 30, lineHeight: 36, fontWeight: '800', color: palette.text, marginBottom: 10},
  subtitle: {fontSize: 18, lineHeight: 24, fontWeight: '700', color: palette.text, marginBottom: 8},
  body: {fontSize: 15, lineHeight: 22, color: palette.muted},
  primaryButton: {
    minHeight: 56,
    backgroundColor: palette.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 14,
  },
  primaryButtonText: {fontSize: 16, fontWeight: '800', color: '#07110f'},
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 10,
  },
  secondaryButtonText: {fontSize: 15, fontWeight: '700', color: palette.text},
  pressed: {opacity: 0.8},
  disabled: {opacity: 0.42},
  riskPill: {alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11, marginVertical: 6},
  riskText: {fontSize: 12, fontWeight: '900', color: '#07110f'},
  riskClean: {backgroundColor: palette.accent},
  riskLow: {backgroundColor: '#b7d87a'},
  riskMedium: {backgroundColor: palette.warning},
  riskHigh: {backgroundColor: palette.danger},
});
