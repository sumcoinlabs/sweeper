export type BleVendorFingerprint = {
  id: string;
  label: string;
  cameraFocused: boolean;
  namePatterns: RegExp[];
};

export type BleKnownDeviceFingerprint = {
  id: string;
  label: string;
  summary: string;
  category: 'consumer' | 'smart_home';
  namePatterns?: RegExp[];
  serviceUUIDs?: string[];
};

export const BLE_VENDOR_FINGERPRINTS: BleVendorFingerprint[] = [
  {
    id: 'reolink',
    label: 'Reolink',
    cameraFocused: true,
    namePatterns: [/\breolink\b/i],
  },
  {
    id: 'arlo',
    label: 'Arlo',
    cameraFocused: true,
    namePatterns: [/\barlo\b/i],
  },
  {
    id: 'ring',
    label: 'Ring',
    cameraFocused: true,
    namePatterns: [/\bring\b/i],
  },
  {
    id: 'blink',
    label: 'Blink',
    cameraFocused: true,
    namePatterns: [/\bblink\b/i],
  },
  {
    id: 'hikvision',
    label: 'Hikvision',
    cameraFocused: true,
    namePatterns: [/\bhikvision\b/i, /\bhik\b.*\bcam\b/i],
  },
  {
    id: 'dahua',
    label: 'Dahua',
    cameraFocused: true,
    namePatterns: [/\bdahua\b/i],
  },
  {
    id: 'amcrest',
    label: 'Amcrest',
    cameraFocused: true,
    namePatterns: [/\bamcrest\b/i],
  },
  {
    id: 'ezviz',
    label: 'EZVIZ',
    cameraFocused: true,
    namePatterns: [/\bezviz\b/i],
  },
  {
    id: 'foscam',
    label: 'Foscam',
    cameraFocused: true,
    namePatterns: [/\bfoscam\b/i],
  },
  {
    id: 'wansview',
    label: 'Wansview',
    cameraFocused: true,
    namePatterns: [/\bwansview\b/i],
  },
  {
    id: 'lorex',
    label: 'Lorex',
    cameraFocused: true,
    namePatterns: [/\blorex\b/i],
  },
  {
    id: 'swann',
    label: 'Swann',
    cameraFocused: true,
    namePatterns: [/\bswann\b/i],
  },
  {
    id: 'wyze',
    label: 'Wyze',
    cameraFocused: false,
    namePatterns: [/\bwyze\b/i],
  },
  {
    id: 'eufy',
    label: 'eufy',
    cameraFocused: false,
    namePatterns: [/\beufy\b/i],
  },
  {
    id: 'tapo',
    label: 'Tapo',
    cameraFocused: false,
    namePatterns: [/\btapo\b/i],
  },
  {
    id: 'nest',
    label: 'Google Nest',
    cameraFocused: false,
    namePatterns: [/\bnest\b/i],
  },
];

const KNOWN_BLE_DEVICES: BleKnownDeviceFingerprint[] = [
  {
    id: 'samsung-tv',
    label: 'Samsung TV',
    summary: 'Common television/media device',
    category: 'consumer',
    namePatterns: [/^\[TV\]\s*/i],
  },
  {
    id: 'google-member-service',
    label: 'Google Bluetooth service',
    summary:
      'Uses a Bluetooth member service assigned to Google; this does not specifically identify a camera',
    category: 'smart_home',
    serviceUUIDs: [
      '0000fe9f-0000-1000-8000-00805f9b34fb',
      '0000fea0-0000-1000-8000-00805f9b34fb',
      '0000feaa-0000-1000-8000-00805f9b34fb',
    ],
  },

  {
    id: 'apple-watch',
    label: 'Apple Watch',
    summary: 'Common personal wearable',
    category: 'consumer',
    namePatterns: [/\bapple\s*watch\b/i],
  },
  {
    id: 'airpods',
    label: 'AirPods',
    summary: 'Common wireless headphones',
    category: 'consumer',
    namePatterns: [/\bairpods?\b/i],
  },
  {
    id: 'apple-tv',
    label: 'Apple TV',
    summary: 'Common media-streaming device',
    category: 'consumer',
    namePatterns: [/\bapple\s*tv\b/i],
  },
  {
    id: 'okin-bed',
    label: 'OKIN adjustable bed',
    summary: 'Bluetooth control for an adjustable bed',
    category: 'consumer',
    namePatterns: [/\bokin(?:-ble)?\b/i],
  },
  {
    id: 'nest-weave',
    label: 'Nest/Google smart-home device',
    summary:
      'Uses a Bluetooth service assigned to Nest Labs; this does not specifically identify a camera',
    category: 'smart_home',
    serviceUUIDs: [
      '0000feaf-0000-1000-8000-00805f9b34fb',
      '0000feb0-0000-1000-8000-00805f9b34fb',
    ],
  },
];

const EXPLICIT_CAMERA_TERMS = [
  /\bcamera\b/i,
  /\bip\s*camera\b/i,
  /\bipcam\b/i,
  /\bipc\b/i,
  /\bdoorbell\b/i,
  /\bvideo\s*doorbell\b/i,
  /\bbaby\s*monitor\b/i,
  /\bnvr\b/i,
  /\bdvr\b/i,
  /\bcam(?:era)?[- _]?\d*\b/i,
];

const COMMON_BLE_COMPANY_LABELS: Record<string, string> = {
  '0x004c': 'Apple',
  '0x0006': 'Microsoft',
  '0x0075': 'Samsung',
  '0x00e0': 'Google',
};

export function matchBleVendor(
  name: string | null | undefined,
): BleVendorFingerprint | null {
  const value = String(name || '').trim();
  if (!value) return null;

  return (
    BLE_VENDOR_FINGERPRINTS.find(fingerprint =>
      fingerprint.namePatterns.some(pattern => pattern.test(value)),
    ) || null
  );
}

export function matchKnownBleDevice(
  name: string | null | undefined,
  serviceUUIDs: string[],
): BleKnownDeviceFingerprint | null {
  const value = String(name || '').trim();
  const normalizedServices = new Set(
    serviceUUIDs.map(normalizeBleUuid),
  );

  return (
    KNOWN_BLE_DEVICES.find(fingerprint => {
      const nameMatch = fingerprint.namePatterns?.some(pattern =>
        pattern.test(value),
      );

      const serviceMatch = fingerprint.serviceUUIDs?.some(uuid =>
        normalizedServices.has(normalizeBleUuid(uuid)),
      );

      return Boolean(nameMatch || serviceMatch);
    }) || null
  );
}

export function hasExplicitCameraTerm(
  name: string | null | undefined,
): boolean {
  const value = String(name || '').trim();
  return Boolean(
    value &&
      EXPLICIT_CAMERA_TERMS.some(pattern => pattern.test(value)),
  );
}

export function normalizeBleUuid(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, '');
}

export function isLikelyProprietaryService(
  uuid: string,
): boolean {
  const normalized = normalizeBleUuid(uuid);

  if (!normalized) return false;

  if (/^18[0-9a-f]{2}$/.test(normalized)) {
    return false;
  }

  if (
    /^000018[0-9a-f]{2}-0000-1000-8000-00805f9b34fb$/.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

export function manufacturerCompanyLabel(
  companyId: string | null | undefined,
): string | null {
  if (!companyId) return null;
  return COMMON_BLE_COMPANY_LABELS[companyId.toLowerCase()] || null;
}
