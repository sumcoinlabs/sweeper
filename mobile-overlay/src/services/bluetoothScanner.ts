import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, type Device, type State} from 'react-native-ble-plx';
import {BLE_SCAN_DURATION_MS} from '../config';
import type {
  BleAssessment,
  BleDeviceFinding,
  BleProximity,
} from '../types';
import {
  hasExplicitCameraTerm,
  isLikelyProprietaryService,
  manufacturerCompanyLabel,
  matchBleVendor,
  matchKnownBleDevice,
  normalizeBleUuid,
} from './bleFingerprints';

const manager = new BleManager();

type ObservedBleDevice = {
  device: Device;
  name: string | null;
  localName: string | null;
  rssis: number[];
  sightings: number;
  serviceUUIDs: Set<string>;
  serviceDataUUIDs: Set<string>;
  manufacturerData: string | null;
};

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function stateError(state: State): Error | null {
  switch (state) {
    case 'Unsupported':
      return new Error(
        'Bluetooth LE is unavailable in this environment. Use a physical phone for a real Bluetooth sweep.',
      );
    case 'PoweredOff':
      return new Error(
        'Bluetooth is turned off. Turn it on and try the check again.',
      );
    case 'Unauthorized':
      return new Error(
        'Bluetooth permission is not available for Sweeper. Allow Bluetooth access and try again.',
      );
    default:
      return null;
  }
}

async function waitForUsableState(timeoutMs = 4000): Promise<void> {
  const current = await manager.state();
  const immediate = stateError(current);

  if (immediate) throw immediate;
  if (current === 'PoweredOn') return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      error ? reject(error) : resolve();
    };

    const subscription = manager.onStateChange(state => {
      const error = stateError(state);
      if (error) finish(error);
      else if (state === 'PoweredOn') finish();
    }, true);

    const timer = setTimeout(() => {
      finish(
        new Error(
          'Bluetooth is not ready yet. Make sure Bluetooth is enabled and try again.',
        ),
      );
    }, timeoutMs);
  });
}

function median(values: number[]): number | null {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round(
    (sorted[middle - 1] + sorted[middle]) / 2,
  );
}

function average(values: number[]): number | null {
  if (!values.length) return null;

  return Math.round(
    (values.reduce((total, value) => total + value, 0) /
      values.length) *
      10,
  ) / 10;
}

function proximityForRssi(
  rssi: number | null,
): BleProximity {
  if (rssi == null) return 'unknown';
  if (rssi >= -50) return 'very_close';
  if (rssi >= -67) return 'nearby';
  return 'farther';
}

function decodeBase64Prefix(
  value: string | null | undefined,
  maxBytes = 2,
): number[] {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const output: number[] = [];
  let buffer = 0;
  let bitCount = 0;

  for (const character of String(value || '').replace(/\s+/g, '')) {
    if (character === '=') break;

    const index = alphabet.indexOf(character);
    if (index < 0) continue;

    buffer = (buffer << 6) | index;
    bitCount += 6;

    while (bitCount >= 8) {
      bitCount -= 8;
      output.push((buffer >> bitCount) & 0xff);

      if (output.length >= maxBytes) {
        return output;
      }
    }
  }

  return output;
}

function manufacturerCompanyId(
  manufacturerData: string | null,
): string | null {
  const bytes = decodeBase64Prefix(manufacturerData, 2);
  if (bytes.length < 2) return null;

  const company = bytes[0] | (bytes[1] << 8);

  return `0x${company
    .toString(16)
    .padStart(4, '0')}`;
}

function buildServiceSignature(
  serviceUUIDs: string[],
): string | null {
  const normalized = [...new Set(
    serviceUUIDs
      .map(normalizeBleUuid)
      .filter(Boolean),
  )].sort();

  return normalized.length
    ? normalized.join('|').slice(0, 1000)
    : null;
}

function assessmentFor(
  name: string | null,
  serviceUUIDs: string[],
  manufacturerData: string | null,
): BleAssessment {
  const vendor = matchBleVendor(name);
  const knownDevice = matchKnownBleDevice(name, serviceUUIDs);
  const cameraTerm = hasExplicitCameraTerm(name);
  const proprietaryServices = serviceUUIDs.filter(
    isLikelyProprietaryService,
  );

  const evidenceCodes: string[] = [];

  if (cameraTerm) {
    evidenceCodes.push('CAMERA_TERM_IN_ADVERTISED_NAME');
  }

  if (vendor) {
    evidenceCodes.push(
      vendor.cameraFocused
        ? 'CAMERA_VENDOR_NAME_MATCH'
        : 'SECURITY_ECOSYSTEM_NAME_MATCH',
    );
  }

  if (proprietaryServices.length > 0) {
    evidenceCodes.push('PROPRIETARY_SERVICE_UUID_PRESENT');
  }

  if (manufacturerData) {
    evidenceCodes.push('MANUFACTURER_DATA_PRESENT');
  }

  if (cameraTerm) {
    return {
      category: 'camera_security',
      evidenceLevel: 'strong',
      userTitle: vendor
        ? `Possible ${vendor.label} camera/security device`
        : 'Possible camera/security device',
      userSummary:
        'This Bluetooth device advertised a name that directly suggests camera, doorbell, monitor, or video-security hardware. That is a strong Bluetooth clue, but it does not prove the device is hidden or improperly placed.',
      matchedVendor: vendor?.label,
      backendReview: true,
      bluetoothOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (vendor?.cameraFocused) {
    return {
      category: 'camera_security',
      evidenceLevel:
        proprietaryServices.length > 0 || manufacturerData
          ? 'strong'
          : 'moderate',
      userTitle: `Possible ${vendor.label} camera/security device`,
      userSummary:
        `This Bluetooth device advertised a name associated with ${vendor.label} camera/security equipment. Sweeper treats it as a device worth checking, not proof of a hidden camera.`,
      matchedVendor: vendor.label,
      backendReview: true,
      bluetoothOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (vendor) {
    return {
      category: 'security_ecosystem',
      evidenceLevel: 'weak',
      userTitle: `${vendor.label} smart-home device`,
      userSummary:
        `This device appears to be part of the ${vendor.label} ecosystem, but the Bluetooth evidence does not specifically identify it as a camera.`,
      matchedVendor: vendor.label,
      backendReview: false,
      bluetoothOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (knownDevice) {
    return {
      category: 'other',
      evidenceLevel: 'none',
      userTitle: knownDevice.label,
      userSummary: knownDevice.summary,
      matchedVendor: undefined,
      backendReview: false,
      bluetoothOnlyThreatEligible: false,
      evidenceCodes: [
        knownDevice.category === 'smart_home'
          ? 'KNOWN_SMART_HOME_SERVICE'
          : 'KNOWN_CONSUMER_DEVICE',
      ],
    };
  }

  return {
    category: name ? 'other' : 'unknown',
    evidenceLevel: 'none',
    userTitle: name
      ? 'Other Bluetooth device'
      : 'Unidentified Bluetooth device',
    userSummary:
      'Sweeper heard this Bluetooth device but did not find a camera-specific fingerprint.',
    backendReview: false,
    bluetoothOnlyThreatEligible: false,
    evidenceCodes: name
      ? ['BLE_DEVICE_ONLY']
      : ['UNNAMED_BLE_DEVICE_ONLY'],
  };
}

function classify(
  observation: ObservedBleDevice,
): BleDeviceFinding {
  const serviceUUIDs = [...observation.serviceUUIDs]
    .map(normalizeBleUuid)
    .filter(Boolean)
    .sort();

  const serviceDataUUIDs = [...observation.serviceDataUUIDs]
    .map(normalizeBleUuid)
    .filter(Boolean)
    .sort();

  const centralRssi = median(observation.rssis);
  const strongestRssi = observation.rssis.length
    ? Math.max(...observation.rssis)
    : null;

  const companyId = manufacturerCompanyId(
    observation.manufacturerData,
  );

  const assessment = assessmentFor(
    observation.name || observation.localName,
    serviceUUIDs,
    observation.manufacturerData,
  );

  const proximity = proximityForRssi(centralRssi);
  const reasons: string[] = [];

  if (assessment.backendReview) {
    reasons.push(assessment.userSummary);

    if (proximity === 'very_close') {
      reasons.push(
        'Bluetooth signal appears very close. Distance is approximate.',
      );
    } else if (proximity === 'nearby') {
      reasons.push(
        'Bluetooth signal appears nearby. Distance is approximate.',
      );
    }
  }

  const suspicionScore =
    assessment.evidenceLevel === 'strong'
      ? 20
      : assessment.evidenceLevel === 'moderate'
        ? 14
        : 0;

  return {
    id: observation.device.id,
    name: observation.name,
    localName: observation.localName,
    rssi: centralRssi,
    averageRssi: average(observation.rssis),
    strongestRssi,
    sightings: observation.sightings,
    proximity,
    serviceUUIDs,
    serviceDataUUIDs,
    manufacturerData: observation.manufacturerData,
    manufacturerCompanyId: companyId,
    manufacturerLabel: manufacturerCompanyLabel(companyId),
    txPowerLevel: observation.device.txPowerLevel ?? null,
    isConnectable: observation.device.isConnectable ?? null,
    serviceSignature: buildServiceSignature(serviceUUIDs),
    assessment,
    suspicionScore,
    reasons,
  };
}

function updateObservation(
  current: ObservedBleDevice | undefined,
  device: Device,
): ObservedBleDevice {
  const observation: ObservedBleDevice =
    current || {
      device,
      name: device.name || null,
      localName: device.localName || null,
      rssis: [],
      sightings: 0,
      serviceUUIDs: new Set<string>(),
      serviceDataUUIDs: new Set<string>(),
      manufacturerData: device.manufacturerData || null,
    };

  observation.device = device;
  observation.sightings += 1;

  if (device.name) observation.name = device.name;
  if (device.localName) observation.localName = device.localName;

  if (
    typeof device.rssi === 'number' &&
    Number.isFinite(device.rssi) &&
    device.rssi < 0 &&
    device.rssi >= -126
  ) {
    observation.rssis.push(device.rssi);

    if (observation.rssis.length > 60) {
      observation.rssis.shift();
    }
  }

  for (const uuid of device.serviceUUIDs || []) {
    observation.serviceUUIDs.add(uuid);
  }

  for (const uuid of Object.keys(device.serviceData || {})) {
    observation.serviceDataUUIDs.add(uuid);
  }

  if (device.manufacturerData) {
    observation.manufacturerData =
      device.manufacturerData;
  }

  return observation;
}

export async function scanBluetooth(
  durationMs = BLE_SCAN_DURATION_MS,
  onCount?: (count: number) => void,
): Promise<BleDeviceFinding[]> {
  const granted = await requestPermissions();

  if (!granted) {
    throw new Error(
      'Bluetooth permission was not granted.',
    );
  }

  await waitForUsableState();

  const observations = new Map<
    string,
    ObservedBleDevice
  >();

  console.log(
    `[SWEEPER][BLE] starting durationMs=${durationMs}`,
  );

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void manager.stopDeviceScan().catch(() => {});
      error ? reject(error) : resolve();
    };

    const timer = setTimeout(
      () => finish(),
      durationMs,
    );

    manager
      .startDeviceScan(
        null,
        {allowDuplicates: true},
        (error, device) => {
          if (error) {
            finish(
              new Error(
                error.message ||
                  'Bluetooth scanning could not start on this device.',
              ),
            );
            return;
          }

          if (!device) return;

          const isNew = !observations.has(device.id);

          observations.set(
            device.id,
            updateObservation(
              observations.get(device.id),
              device,
            ),
          );

          if (isNew) {
            onCount?.(observations.size);
          }
        },
      )
      .catch(error => {
        finish(
          error instanceof Error
            ? error
            : new Error(
                'Bluetooth scanning could not start.',
              ),
        );
      });
  });

  const results = [...observations.values()]
    .map(classify)
    .sort((a, b) => {
      const reviewDifference =
        Number(b.assessment.backendReview) -
        Number(a.assessment.backendReview);

      if (reviewDifference) return reviewDifference;

      if (b.suspicionScore !== a.suspicionScore) {
        return b.suspicionScore - a.suspicionScore;
      }

      return (
        (b.rssi ?? -200) -
        (a.rssi ?? -200)
      );
    });

  if (__DEV__) {
    for (const device of results) {
      console.log(
        `[SWEEPER][BLE][OBSERVED] name=${JSON.stringify(
          device.name || device.localName || 'unnamed',
        )} avg=${device.averageRssi ?? 'n/a'} median=${
          device.rssi ?? 'n/a'
        } strongest=${device.strongestRssi ?? 'n/a'} sightings=${
          device.sightings
        } services=${device.serviceUUIDs.join('|') || 'none'} serviceData=${
          device.serviceDataUUIDs.join('|') || 'none'
        } company=${device.manufacturerCompanyId || 'unknown'} review=${
          device.assessment.backendReview ? 'yes' : 'no'
        } evidence=${device.assessment.evidenceLevel}`,
      );
    }
  }

  console.log(
    `[SWEEPER][BLE] complete records=${results.length} cautions=${
      results.filter(
        device => device.assessment.backendReview,
      ).length
    } named=${
      results.filter(device => Boolean(device.name || device.localName)).length
    } withServices=${
      results.filter(device => device.serviceUUIDs.length > 0).length
    } withManufacturerData=${
      results.filter(device => Boolean(device.manufacturerData)).length
    } recognized=${
      results.filter(device =>
        device.assessment.evidenceCodes.some(code =>
          ['KNOWN_CONSUMER_DEVICE', 'KNOWN_SMART_HOME_SERVICE'].includes(code),
        ),
      ).length
    }`,
  );

  return results;
}
