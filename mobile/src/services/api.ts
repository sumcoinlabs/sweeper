import {API_BASE_URL} from '../config';
import type {EvidencePhoto, SweepSession} from '../types';

export async function submitSweep(session: SweepSession) {
  if (!session.location) throw new Error('Location is required.');

  const response = await fetch(`${API_BASE_URL}/api/scans`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      anonymousId: session.anonymousId,
      location: session.location,
      networkDevices: session.networkDevices,
      bleDevices: session.bleDevices,
      checklist: session.checklist,
      evidencePhotoCount: session.photos.length,
      sweepCompleted: session.checklist.every(item => item.status !== 'pending'),
      notes: session.notes,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend rejected scan (${response.status}): ${text}`);
  }

  return response.json();
}

export async function uploadEvidencePhoto(scanId: string, photo: EvidencePhoto) {
  const body = new FormData();
  body.append('photo', {
    uri: photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
    name: `sweeper-${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as never);

  const response = await fetch(`${API_BASE_URL}/api/scans/${scanId}/photos`, {
    method: 'POST',
    body,
  });
  if (!response.ok) throw new Error(`Photo upload failed (${response.status})`);
  return response.json();
}
