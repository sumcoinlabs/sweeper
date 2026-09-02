import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
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
import type {ChecklistItem, ChecklistStatus} from '../types';

export function ChecklistScreen({
  items,
  onChange,
  onOpenCamera,
  onContinue,
  onBack,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  onOpenCamera: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const firstPending = useMemo(
    () => items.findIndex(item => item.status === 'pending'),
    [items],
  );
  const [index, setIndex] = useState(
    firstPending >= 0 ? firstPending : Math.max(0, items.length - 1),
  );

  const item = items[index];
  const complete = items.filter(entry => entry.status !== 'pending').length;
  const suspicious = items.filter(entry => entry.status === 'suspicious').length;
  const allDone = complete === items.length;

  const setStatus = (status: ChecklistStatus) => {
    const next = items.map(entry =>
      entry.id === item.id ? {...entry, status} : entry,
    );
    onChange(next);

    if (index < items.length - 1) {
      setIndex(index + 1);
    }
  };

  if (!item) {
    return (
      <Screen>
        <Title>Physical check</Title>
        <Body>No physical-check items are configured.</Body>
        <SecondaryButton title="Back" onPress={onBack} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View>
          <Title>Quick physical check</Title>
          <Body>
            Four fast checks cover the most useful hiding areas. Do not dismantle
            electrical, fire-safety or building equipment.
          </Body>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progress}>
            {complete}/{items.length} completed
          </Text>
          {suspicious > 0 ? (
            <Text style={styles.flagCount}>{suspicious} marked for review</Text>
          ) : null}
        </View>

        <View style={styles.dots}>
          {items.map((entry, i) => (
            <Pressable
              key={entry.id}
              onPress={() => setIndex(i)}
              style={[
                styles.dot,
                entry.status === 'clear' && styles.dotClear,
                entry.status === 'suspicious' && styles.dotSuspicious,
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Card style={styles.checkCard}>
          <Text style={styles.stepLabel}>
            CHECK {index + 1} OF {items.length}
          </Text>
          <Subtitle>{item.title}</Subtitle>

          {item.guidance.map(line => (
            <Text key={line} style={styles.guidance}>
              • {line}
            </Text>
          ))}

          <View style={styles.choiceStack}>
            <Pressable
              onPress={() => setStatus('clear')}
              style={[
                styles.choice,
                item.status === 'clear' && styles.choiceClear,
              ]}>
              <Text style={styles.choiceText}>Nothing suspicious</Text>
            </Pressable>

            <Pressable
              onPress={() => setStatus('suspicious')}
              style={[
                styles.choice,
                item.status === 'suspicious' && styles.choiceSuspicious,
              ]}>
              <Text style={styles.choiceText}>Mark for review</Text>
            </Pressable>
          </View>
        </Card>

        <View style={styles.areaNavigation}>
          {index > 0 ? (
            <SecondaryButton
              title="Previous area"
              onPress={() => setIndex(index - 1)}
            />
          ) : null}
          {index < items.length - 1 ? (
            <SecondaryButton
              title="Next area"
              onPress={() => setIndex(index + 1)}
            />
          ) : null}
        </View>

        <Card style={styles.cameraCard}>
          <Subtitle>See something questionable?</Subtitle>
          <Body>
            Open the Camera Scanner to inspect it for a lens-like reflection or infrared light and optionally save an evidence photo.
          </Body>
          <SecondaryButton title="OPEN CAMERA SCANNER" onPress={onOpenCamera} />
        </Card>

        <PrimaryButton
          title={allDone ? 'REVIEW SWEEP' : 'FINISH THE 4 CHECKS TO REVIEW'}
          onPress={onContinue}
          disabled={!allDone}
        />
        <SecondaryButton title="Back" onPress={onBack} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {paddingTop: 10, paddingBottom: 12},
  progressRow: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progress: {color: palette.accent, fontWeight: '800'},
  flagCount: {color: palette.warning, fontWeight: '700', fontSize: 12},
  dots: {flexDirection: 'row', gap: 8, marginBottom: 16},
  dot: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: palette.border,
  },
  dotActive: {borderWidth: 1, borderColor: palette.text},
  dotClear: {backgroundColor: palette.accent},
  dotSuspicious: {backgroundColor: palette.warning},
  checkCard: {padding: 18},
  stepLabel: {
    color: palette.accent,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontSize: 11,
    marginBottom: 8,
  },
  guidance: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 7,
  },
  choiceStack: {marginTop: 18, gap: 10},
  choice: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceClear: {borderColor: palette.accent, backgroundColor: '#102a26'},
  choiceSuspicious: {
    borderColor: palette.warning,
    backgroundColor: '#2b2416',
  },
  choiceText: {color: palette.text, fontWeight: '800', fontSize: 14},
  areaNavigation: {marginBottom: 8},
  cameraCard: {marginTop: 8},
});
