// Simulator default. For a physical phone, replace with your Mac/server LAN IP.
export const API_BASE_URL = 'http://127.0.0.1:8787';

export const NETWORK_SCAN_PORTS = [80, 443, 554, 8000, 8080, 8554, 8899, 37777, 34567] as const;
export const NETWORK_SCAN_CONCURRENCY = 48;
export const NETWORK_PROBE_TIMEOUT_MS = 320;
export const BLE_SCAN_DURATION_MS = 8000;
