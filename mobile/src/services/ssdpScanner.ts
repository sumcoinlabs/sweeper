import {NativeModules} from 'react-native';
import type {SsdpServiceFinding} from '../types';

export type SsdpDiscovery = SsdpServiceFinding & {
  ip: string;
};

type NativeSsdpModule = {
  scan(timeoutMs: number): Promise<unknown>;
};

const nativeSsdp = NativeModules.SweeperSSDP as
  | NativeSsdpModule
  | undefined;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

export async function scanSsdp(
  timeoutMs = 3500,
): Promise<SsdpDiscovery[]> {
  if (!nativeSsdp?.scan) {
    throw new Error(
      'Native SSDP discovery module is not available in this build.',
    );
  }

  const raw = await nativeSsdp.scan(timeoutMs);

  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const results: SsdpDiscovery[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const row = item as Record<string, unknown>;
    const ip = asString(row.ip);
    if (!ip) continue;

    const result: SsdpDiscovery = {
      ip,
      st: asString(row.st),
      usn: asString(row.usn),
      location: asString(row.location),
      server: asString(row.server),
    };

    const key = [
      result.ip,
      result.usn || '',
      result.st || '',
      result.location || '',
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result);
  }

  return results;
}
