import type {SweepSession, RiskResult} from '../types';

const cameraPorts = new Set([554, 8554, 37777, 34567]);
const embeddedPorts = new Set([8000, 8080, 8899]);
const cameraNameHints = ['camera', 'cam', 'ipc', 'ipcam', 'wyze', 'arlo', 'ring', 'eufy', 'hikvision', 'dahua', 'reolink', 'amcrest', 'ezviz', 'foscam', 'nest cam'];

export function calculateRisk(session: SweepSession): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  for (const device of session.networkDevices) {
    const associated = device.openPorts.filter(port => cameraPorts.has(port));
    const embedded = device.openPorts.filter(port => embeddedPorts.has(port));
    if (associated.length) {
      score += associated.some(port => port === 554 || port === 8554) ? 28 : 22;
      reasons.push(`${device.ip} exposes camera/DVR-associated service port(s): ${associated.join(', ')}`);
    }
    if (embedded.length) score += 4;
    if (device.openPorts.includes(80) || device.openPorts.includes(443)) score += 1;
  }

  for (const device of session.bleDevices) {
    const name = (device.name || '').toLowerCase();
    const namedLikeCamera = cameraNameHints.some(hint => name.includes(hint));
    if (namedLikeCamera) {
      score += 16;
      reasons.push(`Nearby Bluetooth device name resembles camera/security hardware: ${device.name}`);
    } else if (!name && (device.rssi ?? -100) >= -55) {
      score += 6;
      reasons.push('Strong nearby unnamed Bluetooth device detected.');
    } else if (!name && (device.rssi ?? -100) >= -70) {
      score += 2;
    }
  }

  const suspicious = session.checklist.filter(item => item.status === 'suspicious');
  if (suspicious.length) {
    score += Math.min(40, suspicious.length * 20);
    reasons.push(`${suspicious.length} physical inspection item(s) marked suspicious.`);
  }

  if (session.photos.length && suspicious.length) {
    score += Math.min(15, session.photos.length * 5);
    reasons.push(`${session.photos.length} evidence photo(s) captured.`);
  }

  score = Math.max(0, Math.min(100, score));
  let label = 'No indicators';
  if (score >= 50) label = 'High concern';
  else if (score >= 25) label = 'Moderate concern';
  else if (score >= 10) label = 'Low concern';

  return {score, label, reasons};
}
