import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Body, Card, PrimaryButton, RiskPill, Screen, SecondaryButton, Subtitle, Title, palette} from '../components/ui';
import {submitSweep, uploadEvidencePhoto} from '../services/api';
import type {SweepSession} from '../types';
import {calculateRisk} from '../utils/risk';

export function SummaryScreen({
  session,
  onNotes,
  onBack,
  onRestart,
}: {
  session: SweepSession;
  onNotes: (notes: string) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const risk = useMemo(() => calculateRisk(session), [session]);
  const [notes, setNotes] = useState(session.notes);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const suspiciousPhysical = session.checklist.filter(item => item.status === 'suspicious').length;
  const suspiciousNetwork = session.networkDevices.filter(item => item.suspicionScore >= 20).length;
  const suspiciousBle = session.bleDevices.filter(item => item.suspicionScore >= 10).length;

  const submit = async () => {
    setSubmitting(true);
    setStatus('');
    try {
      onNotes(notes);
      const payload = {...session, notes};
      const result = await submitSweep(payload);
      const scanId = result?.scan?.id;
      if (scanId && session.photos.length) {
        for (let i = 0; i < session.photos.length; i += 1) {
          setStatus(`Uploading evidence photo ${i + 1}/${session.photos.length}…`);
          await uploadEvidencePhoto(scanId, session.photos[i]);
        }
      }
      setStatus(`Submitted. Server risk: ${result?.risk?.label || risk.label} ${result?.risk?.score ?? risk.score}/100`);
    } catch (e) {
      setStatus(`Not submitted: ${e instanceof Error ? e.message : String(e)}. The scan can still be reviewed on this device.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <Title>Sweep summary</Title>
        <RiskPill score={risk.score} label={risk.label} />
        <Body>This is an evidence-weighted concern score, not a determination that a hidden camera exists.</Body>

        <Card>
          <Subtitle>{session.location?.name || 'Current property'}</Subtitle>
          <Body>{session.location?.address || 'No address'}</Body>
        </Card>

        <Card>
          <View style={styles.metricRow}><Text style={styles.metric}>LAN hosts found</Text><Text style={styles.value}>{session.networkDevices.length}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metric}>LAN devices to review</Text><Text style={styles.value}>{suspiciousNetwork}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metric}>BLE devices found</Text><Text style={styles.value}>{session.bleDevices.length}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metric}>BLE devices to review</Text><Text style={styles.value}>{suspiciousBle}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metric}>Physical suspicious marks</Text><Text style={styles.value}>{suspiciousPhysical}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metric}>Evidence photos</Text><Text style={styles.value}>{session.photos.length}</Text></View>
        </Card>

        {risk.reasons.length ? (
          <Card>
            <Subtitle>Why this score changed</Subtitle>
            {risk.reasons.map(reason => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
          </Card>
        ) : (
          <Card><Body>No suspicious evidence was scored in this sweep.</Body></Card>
        )}

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => onNotes(notes)}
          multiline
          placeholder="Optional notes about the room or findings"
          placeholderTextColor={palette.muted}
          style={styles.input}
        />

        {status ? <Text style={styles.status}>{status}</Text> : null}
        <PrimaryButton title="SUBMIT TO SELF-HOSTED SWEEPER DB" onPress={submit} loading={submitting} disabled={!session.location} />
        <SecondaryButton title="Back to checklist" onPress={onBack} />
        <SecondaryButton title="Start a new sweep" onPress={onRestart} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border},
  metric: {color: palette.muted, fontSize: 14},
  value: {color: palette.text, fontWeight: '900'},
  reason: {color: palette.text, lineHeight: 21, marginTop: 5},
  label: {color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 6},
  input: {minHeight: 90, color: palette.text, backgroundColor: palette.panel, borderColor: palette.border, borderWidth: 1, borderRadius: 14, padding: 14, textAlignVertical: 'top'},
  status: {color: palette.accent, marginTop: 14, lineHeight: 20, fontWeight: '700'},
});
