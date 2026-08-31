const CAMERA_NAME_HINTS = [
  'camera', 'cam', 'ipc', 'ipcam', 'wyze', 'arlo', 'ring', 'eufy',
  'hikvision', 'dahua', 'reolink', 'amcrest', 'ezviz', 'foscam', 'nest cam',
];

const CAMERA_PORTS = new Set([554, 8554, 37777, 34567]);
const EMBEDDED_PORTS = new Set([8000, 8080, 8899]);

export function calculateRisk(input = {}) {
  const networkDevices = Array.isArray(input.networkDevices)
    ? input.networkDevices
    : [];
  const bleDevices = Array.isArray(input.bleDevices) ? input.bleDevices : [];
  const checklist = Array.isArray(input.checklist) ? input.checklist : [];
  const evidencePhotos = Number(input.evidencePhotoCount || 0);

  let score = 0;
  const reasons = [];

  for (const device of networkDevices) {
    const ports = Array.isArray(device.openPorts)
      ? device.openPorts.map(Number)
      : [];
    const cameraPorts = ports.filter(port => CAMERA_PORTS.has(port));
    const embeddedPorts = ports.filter(port => EMBEDDED_PORTS.has(port));

    if (cameraPorts.length > 0) {
      score +=
        cameraPorts.includes(554) || cameraPorts.includes(8554) ? 28 : 22;
      reasons.push(
        `LAN host ${device.ip || 'unknown'} exposes camera/DVR-associated service port(s): ${cameraPorts.join(', ')}`,
      );
    }

    if (embeddedPorts.length > 0) {
      score += 4;
    }

    if (ports.includes(80) || ports.includes(443)) {
      score += 1;
    }
  }

  // Generic BLE proximity does not imply camera evidence. Only a camera/security
  // fingerprint contributes BLE risk.
  for (const device of bleDevices) {
    const name = String(device.name || '').toLowerCase();
    const cameraName = CAMERA_NAME_HINTS.some(hint => name.includes(hint));

    if (cameraName) {
      score += 16;
      reasons.push(
        `Nearby Bluetooth device name resembles camera/security hardware: ${device.name}`,
      );
    }
  }

  const suspiciousChecks = checklist.filter(
    item => item?.status === 'suspicious',
  );

  if (suspiciousChecks.length > 0) {
    score += Math.min(40, suspiciousChecks.length * 20);
    reasons.push(
      `${suspiciousChecks.length} physical inspection item(s) marked suspicious by the user.`,
    );
  }

  if (evidencePhotos > 0 && suspiciousChecks.length > 0) {
    score += Math.min(15, evidencePhotos * 5);
    reasons.push(
      `${evidencePhotos} evidence photo(s) captured for suspicious physical findings.`,
    );
  }

  score = Math.max(0, Math.min(100, score));

  let label = 'No indicators';
  if (score >= 50) label = 'High concern';
  else if (score >= 25) label = 'Moderate concern';
  else if (score >= 10) label = 'Low concern';

  return {score, label, reasons};
}
