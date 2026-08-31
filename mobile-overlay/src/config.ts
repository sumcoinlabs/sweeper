import {NativeModules} from 'react-native';

// Simulator default. For a physical phone, replace with your Mac/server LAN IP.
function getDevelopmentApiBaseUrl(): string {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const match = scriptURL?.match(/^https?:\/\/([^/:]+)/);

  if (match?.[1]) {
    const host = match[1] === 'localhost' ? '127.0.0.1' : match[1];
    return `http://${host}:8787`;
  }

  return 'http://127.0.0.1:8787';
}

export const API_BASE_URL = __DEV__
  ? getDevelopmentApiBaseUrl()
  : 'https://api.sweeper.invalid';

export const NETWORK_SCAN_PORTS = [80, 443, 554, 8000, 8080, 8554, 8899, 37777, 34567] as const;
export const NETWORK_SCAN_CONCURRENCY = 48;
export const NETWORK_PROBE_TIMEOUT_MS = 320;
export const BLE_SCAN_DURATION_MS = 8000;
