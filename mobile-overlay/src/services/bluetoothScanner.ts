import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, type Device, type State} from 'react-native-ble-plx';
import {BLE_SCAN_DURATION_MS} from '../config';
import type {BleDeviceFinding} from '../types';

const manager = new BleManager();
const cameraHints = [
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
];

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
        'Bluetooth LE is unavailable in this environment. The iOS Simulator does not provide real BLE scanning, so test this step on a physical iPhone.',
      );
    case 'PoweredOff':
      return new Error('Bluetooth is turned off. Turn it on and try the scan again.');
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
          'Bluetooth is not ready yet. If this is the iOS Simulator, use a physical iPhone for BLE testing.',
        ),
      );
    }, timeoutMs);
  });
}

function classify(device: Device): BleDeviceFinding {
  const name = device.name || device.localName || null;
  const normalized = (name || '').toLowerCase();
  const rssi = device.rssi ?? null;
  let suspicionScore = 0;
  const reasons: string[] = [];

  if (cameraHints.some(hint => normalized.includes(hint))) {
    suspicionScore += 16;
    reasons.push('Advertised name resembles camera/security hardware.');
  }

  if (!name && (rssi ?? -100) >= -55) {
    suspicionScore += 6;
    reasons.push('Unnamed BLE device with a strong nearby signal.');
  } else if (!name && (rssi ?? -100) >= -70) {
    suspicionScore += 2;
    reasons.push('Unnamed BLE device detected nearby.');
  }

  return {
    id: device.id,
    name,
    rssi,
    serviceUUIDs: device.serviceUUIDs || [],
    manufacturerData: device.manufacturerData,
    suspicionScore,
    reasons,
  };
}

export async function scanBluetooth(
  durationMs = BLE_SCAN_DURATION_MS,
  onCount?: (count: number) => void,
): Promise<BleDeviceFinding[]> {
  const granted = await requestPermissions();
  if (!granted) {
    throw new Error('Bluetooth permission was not granted.');
  }

  await waitForUsableState();

  const devices = new Map<string, Device>();

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void manager.stopDeviceScan().catch(() => {});
      error ? reject(error) : resolve();
    };

    const timer = setTimeout(() => finish(), durationMs);

    manager
      .startDeviceScan(null, {allowDuplicates: true}, (error, device) => {
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
        const existing = devices.get(device.id);
        if (!existing || (device.rssi ?? -200) > (existing.rssi ?? -200)) {
          devices.set(device.id, device);
          onCount?.(devices.size);
        }
      })
      .catch(error => {
        finish(
          error instanceof Error
            ? error
            : new Error('Bluetooth scanning could not start.'),
        );
      });
  });

  return [...devices.values()]
    .map(classify)
    .sort(
      (a, b) =>
        b.suspicionScore - a.suspicionScore ||
        (b.rssi ?? -200) - (a.rssi ?? -200),
    );
}
