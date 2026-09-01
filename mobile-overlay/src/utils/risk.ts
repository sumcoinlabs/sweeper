import type {SweepSession, RiskResult} from '../types';

const cameraPorts = new Set([554, 8554, 37777, 34567]);
const cameraMdnsTypes = new Set([
  '_rtsp._tcp',
  '_axis-video._tcp',
  '_axis-nvr._tcp',
  '_vapix-http._tcp',
  '_vapix-https._tcp',
]);
const ssdpCameraHints = [
  'camera',
  'ip camera',
  'ipcam',
  'network camera',
  'nvr',
  'dvr',
  'onvif',
  'axis',
  'hikvision',
  'dahua',
  'reolink',
  'amcrest',
  'foscam',
  'eufy',
  'wyze',
  'arlo',
  'ring',
  'ezviz',
];
const embeddedPorts = new Set([8000, 8080, 8899]);
const cameraNameHints = [
  'camera',
  'cam',
  'ipc',
  'ipcam',
  'wyze',
  'arlo',
  'ring',
  'eufy',
  'hikvision',
  'dahua',
  'reolink',
  'amcrest',
  'ezviz',
  'foscam',
  'nest cam',
];

export function calculateRisk(session: SweepSession): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  for (const device of session.networkDevices) {
    const associated = device.openPorts.filter(port => cameraPorts.has(port));
    const embedded = device.openPorts.filter(port => embeddedPorts.has(port));

    if (associated.length) {
      score += associated.some(port => port === 554 || port === 8554)
        ? 28
        : 22;
      reasons.push(
        `${device.ip} exposes camera/DVR-associated service port(s): ${associated.join(
          ', ',
        )}`,
      );
    }

    if (embedded.length) {
      score += 4;
    }

    if (device.openPorts.includes(80) || device.openPorts.includes(443)) {
      score += 1;
    }

    const mdnsCameraServices = (device.bonjourServices || []).filter(service =>
      cameraMdnsTypes.has(service.type),
    );

    if (mdnsCameraServices.length && associated.length === 0) {
      score += 28;
      reasons.push(
        `${device.hostname || device.ip} advertises camera/video Bonjour service(s): ${[
          ...new Set(mdnsCameraServices.map(service => service.type)),
        ].join(', ')}`,
      );
    }

    const ssdpText = (device.ssdpServices || [])
      .map(service =>
        [
          service.st || '',
          service.usn || '',
          service.server || '',
          service.location || '',
        ].join(' '),
      )
      .join(' ')
      .toLowerCase();

    if (ssdpCameraHints.some(hint => ssdpText.includes(hint))) {
      score += 24;
      reasons.push(
        `${device.hostname || device.ip} advertises an SSDP/UPnP camera or security-device fingerprint.`,
      );
    }

    const fingerprints = device.fingerprints || [];
    const confirmedRtsp = fingerprints.filter(
      fingerprint =>
        fingerprint.protocol === 'rtsp' &&
        fingerprint.confirmed,
    );

    const cameraHttp = fingerprints.filter(
      fingerprint =>
        fingerprint.protocol === 'http' &&
        fingerprint.cameraHint,
    );

    if (confirmedRtsp.length > 0) {
      score += 10;
      reasons.push(
        `${device.hostname || device.ip} returned a confirmed RTSP protocol response.`,
      );
    }

    if (cameraHttp.length > 0) {
      score += 24;
      reasons.push(
        `${device.hostname || device.ip} returned an HTTP camera/security fingerprint.`,
      );
    }
  }

  // RSSI alone is proximity evidence, not camera evidence. Keep unnamed/unknown
  // BLE devices visible in the BLE results, but do not let generic nearby BLE
  // advertisements create a high hidden-camera concern score.
  for (const device of session.bleDevices) {
    const name = (device.name || '').toLowerCase();
    const namedLikeCamera = cameraNameHints.some(hint => name.includes(hint));

    if (namedLikeCamera) {
      score += 16;
      reasons.push(
        `Nearby Bluetooth device name resembles camera/security hardware: ${device.name}`,
      );
    }
  }

  const suspicious = session.checklist.filter(
    item => item.status === 'suspicious',
  );

  if (suspicious.length) {
    score += Math.min(40, suspicious.length * 20);
    reasons.push(
      `${suspicious.length} physical inspection item(s) marked suspicious.`,
    );
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
