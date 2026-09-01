import {NativeModules} from 'react-native';

export type IcmpDiscovery = {
  ip: string;
  rttMs?: number;
};

type NativeNetworkDiscovery = {
  scanIcmp(localIPv4: string, timeoutMs: number): Promise<unknown>;
};

const nativeNetworkDiscovery = NativeModules.SweeperSSDP as
  | NativeNetworkDiscovery
  | undefined;

export async function scanIcmpSubnet(
  localIPv4: string,
  timeoutMs = 1800,
): Promise<IcmpDiscovery[]> {
  if (!nativeNetworkDiscovery?.scanIcmp) {
    throw new Error(
      'Native ICMP discovery is not available in this build.',
    );
  }

  const raw = await nativeNetworkDiscovery.scanIcmp(
    localIPv4,
    timeoutMs,
  );

  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const results: IcmpDiscovery[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const row = item as Record<string, unknown>;
    const ip = typeof row.ip === 'string' ? row.ip.trim() : '';
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);

    results.push({
      ip,
      rttMs:
        typeof row.rttMs === 'number' &&
        Number.isFinite(row.rttMs)
          ? row.rttMs
          : undefined,
    });
  }

  return results.sort((a, b) => {
    const ao = Number(a.ip.split('.').pop() || 0);
    const bo = Number(b.ip.split('.').pop() || 0);
    return ao - bo;
  });
}
