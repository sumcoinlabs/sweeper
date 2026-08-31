import {
  BonjourScanner,
  requestLocalNetworkPermission,
  type ScanResult,
} from '@dawidzawada/bonjour-zeroconf';
import type {BonjourServiceFinding} from '../types';

export type BonjourDiscovery = BonjourServiceFinding & {
  ipv4?: string;
  ipv6?: string;
};

export const BONJOUR_SERVICE_TYPES = [
  '_http._tcp',
  '_https._tcp',
  '_rtsp._tcp',
  '_hap._tcp',
  '_axis-video._tcp',
  '_axis-nvr._tcp',
  '_vapix-http._tcp',
  '_vapix-https._tcp',
  '_googlecast._tcp',
  '_airplay._tcp',
] as const;

export async function ensureLocalNetworkPermission(): Promise<void> {
  const granted = await requestLocalNetworkPermission();
  if (!granted) {
    throw new Error(
      'Local Network access is required for Wi-Fi device discovery.',
    );
  }
}

function normalizeResult(
  type: string,
  result: ScanResult,
): BonjourDiscovery {
  return {
    type,
    name: result.name || 'Unnamed Bonjour service',
    hostname: result.hostname || undefined,
    port: result.port || undefined,
    ipv4: result.ipv4 || undefined,
    ipv6: result.ipv6 || undefined,
  };
}

export async function scanBonjourServices(
  onProgress?: (completedTypes: number, totalTypes: number, serviceCount: number) => void,
): Promise<BonjourDiscovery[]> {
  const discoveries: BonjourDiscovery[] = [];
  let completedTypes = 0;

  const tasks = BONJOUR_SERVICE_TYPES.map(async type => {
    const scanner = new BonjourScanner({
      id: `sweeper-${type.replace(/[^a-z0-9]/gi, '-')}`,
    });

    try {
      const results = await scanner.scanFor(6, type, 'local', {
        addressResolveTimeout: 5000,
      });

      const normalized = results.map(result => normalizeResult(type, result));
      discoveries.push(...normalized);
      return normalized;
    } catch {
      // One service type failing should not kill the entire network sweep.
      return [];
    } finally {
      try {
        scanner.stop();
      } catch {
        // Best-effort cleanup.
      }
      completedTypes += 1;
      onProgress?.(
        completedTypes,
        BONJOUR_SERVICE_TYPES.length,
        discoveries.length,
      );
    }
  });

  await Promise.all(tasks);

  const seen = new Set<string>();
  return discoveries.filter(item => {
    const key = [
      item.type,
      item.ipv4 || item.ipv6 || '',
      item.hostname || '',
      item.name,
      item.port || '',
    ].join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
