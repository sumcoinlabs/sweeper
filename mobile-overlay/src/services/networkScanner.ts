import TcpSocket from 'react-native-tcp-socket';
import {NetworkInfo} from 'react-native-network-info';
import {
  NETWORK_PROBE_TIMEOUT_MS,
  NETWORK_SCAN_CONCURRENCY,
  NETWORK_SCAN_PORTS,
} from '../config';
import type {
  BonjourServiceFinding,
  NetworkDevice,
  SsdpServiceFinding,
} from '../types';
import {
  ensureLocalNetworkPermission,
  scanBonjourServices,
  type BonjourDiscovery,
} from './bonjourScanner';
import {scanSsdp, type SsdpDiscovery} from './ssdpScanner';

type Progress = {
  phase: 'tcp' | 'mdns' | 'ssdp';
  completed: number;
  total: number;
  foundHosts: number;
  foundServices: number;
};

type Task = {host: string; port: number};

type MutableDevice = {
  ip: string;
  hostname?: string;
  openPorts: number[];
  bonjourServices: BonjourServiceFinding[];
  ssdpServices: SsdpServiceFinding[];
  discoverySources: Array<'tcp' | 'mdns' | 'ssdp'>;
};

const directCameraServiceTypes = new Set([
  '_rtsp._tcp',
  '_axis-video._tcp',
  '_axis-nvr._tcp',
  '_vapix-http._tcp',
  '_vapix-https._tcp',
]);

const cameraTextHints = [
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

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function probe(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;

    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.destroy();
      } catch {}
      resolve(open);
    };

    const timer = setTimeout(
      () => finish(false),
      NETWORK_PROBE_TIMEOUT_MS + 80,
    );

    try {
      socket = TcpSocket.createConnection(
        {host, port, connectTimeout: NETWORK_PROBE_TIMEOUT_MS},
        () => finish(true),
      );
      socket.on('error', () => finish(false));
      socket.on('timeout', () => finish(false));
    } catch {
      finish(false);
    }
  });
}

function addSource(
  sources: Array<'tcp' | 'mdns' | 'ssdp'>,
  source: 'tcp' | 'mdns' | 'ssdp',
) {
  if (!sources.includes(source)) sources.push(source);
}

function includesCameraHint(text: string): boolean {
  const lower = text.toLowerCase();
  return cameraTextHints.some(hint => lower.includes(hint));
}

function classify(device: MutableDevice): NetworkDevice {
  let suspicionScore = 0;
  const reasons: string[] = [];

  const rtsp = device.openPorts.filter(port => port === 554 || port === 8554);
  const dvr = device.openPorts.filter(
    port => port === 37777 || port === 34567,
  );
  const embedded = device.openPorts.filter(port =>
    [8000, 8080, 8899].includes(port),
  );

  if (rtsp.length) {
    suspicionScore = Math.max(suspicionScore, 28);
    reasons.push(`RTSP-associated port open: ${rtsp.join(', ')}`);
  }

  if (dvr.length) {
    suspicionScore = Math.max(suspicionScore, 22);
    reasons.push(
      `DVR/IP-camera-associated port open: ${dvr.join(', ')}`,
    );
  }

  if (embedded.length) {
    suspicionScore = Math.max(suspicionScore, 4);
    reasons.push(
      `Embedded-device service port open: ${embedded.join(', ')}`,
    );
  }

  const directServices = device.bonjourServices.filter(service =>
    directCameraServiceTypes.has(service.type),
  );

  if (directServices.length) {
    suspicionScore = Math.max(suspicionScore, 30);
    reasons.push(
      `Camera/video Bonjour service advertised: ${[
        ...new Set(directServices.map(service => service.type)),
      ].join(', ')}`,
    );
  }

  const bonjourText = [
    device.hostname || '',
    ...device.bonjourServices.map(service => service.name),
  ].join(' ');

  if (includesCameraHint(bonjourText)) {
    suspicionScore = Math.max(suspicionScore, 18);
    reasons.push(
      'Bonjour name/hostname contains a camera or security-device hint.',
    );
  }

  const ssdpCameraMatches = device.ssdpServices.filter(service =>
    includesCameraHint(
      [
        service.st || '',
        service.usn || '',
        service.server || '',
        service.location || '',
      ].join(' '),
    ),
  );

  if (ssdpCameraMatches.length) {
    suspicionScore = Math.max(suspicionScore, 24);
    reasons.push(
      'SSDP/UPnP advertisement contains a camera, NVR/DVR, ONVIF or known security-vendor hint.',
    );
  }

  const homeKit = device.bonjourServices.some(
    service => service.type === '_hap._tcp',
  );
  if (homeKit) {
    reasons.push(
      'HomeKit accessory advertised. HomeKit alone does not identify a camera.',
    );
  }

  const media = device.bonjourServices.some(service =>
    ['_airplay._tcp', '_googlecast._tcp'].includes(service.type),
  );
  if (media) {
    reasons.push(
      'Common media-device service advertised; this is informational, not camera evidence.',
    );
  }

  if (
    (device.openPorts.includes(80) || device.openPorts.includes(443)) &&
    reasons.length === 0
  ) {
    suspicionScore = Math.max(suspicionScore, 1);
    reasons.push(
      'Web administration service detected; device type is unknown.',
    );
  }

  if (
    device.ssdpServices.length > 0 &&
    ssdpCameraMatches.length === 0 &&
    reasons.length === 0
  ) {
    reasons.push(
      'UPnP/SSDP device advertised on the local network; device type is not camera-specific.',
    );
  }

  return {
    ip: device.ip,
    hostname: device.hostname,
    openPorts: [...new Set(device.openPorts)].sort((a, b) => a - b),
    bonjourServices: device.bonjourServices,
    ssdpServices: device.ssdpServices,
    discoverySources: device.discoverySources,
    suspicionScore,
    reasons,
  };
}

function keyForBonjour(item: BonjourDiscovery): string | null {
  return item.ipv4 || item.ipv6 || item.hostname || null;
}

export async function scanLocalNetwork(
  onProgress?: (progress: Progress) => void,
): Promise<NetworkDevice[]> {
  const ip = String(await NetworkInfo.getIPV4Address());

  console.log(`[SWEEPER][WIFI] local IPv4=${ip || 'unavailable'}`);

  if (!ip || !isPrivateIpv4(ip)) {
    throw new Error(
      `Sweeper only scans the current private LAN. Current IPv4: ${
        ip || 'unavailable'
      }`,
    );
  }

  await ensureLocalNetworkPermission();

  const devices = new Map<string, MutableDevice>();

  const getDevice = (key: string, fallbackIp = key): MutableDevice => {
    const existing = devices.get(key);
    if (existing) return existing;

    const created: MutableDevice = {
      ip: fallbackIp,
      openPorts: [],
      bonjourServices: [],
      ssdpServices: [],
      discoverySources: [],
    };
    devices.set(key, created);
    return created;
  };

  const parts = ip.split('.');
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const tasks: Task[] = [];

  for (let host = 1; host <= 254; host += 1) {
    const candidate = `${prefix}.${host}`;
    if (candidate === ip) continue;

    for (const port of NETWORK_SCAN_PORTS) {
      tasks.push({host: candidate, port});
    }
  }

  let cursor = 0;
  let completed = 0;

  const tcpScan = async () => {
    console.log(
      `[SWEEPER][WIFI][TCP] starting ${tasks.length} safe connection probes`,
    );

    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= tasks.length) return;

        const task = tasks[index];
        const open = await probe(task.host, task.port);

        if (open) {
          const device = getDevice(task.host, task.host);
          device.openPorts.push(task.port);
          addSource(device.discoverySources, 'tcp');
          console.log(
            `[SWEEPER][WIFI][TCP] ${task.host}:${task.port} open`,
          );
        }

        completed += 1;

        if (completed % 20 === 0 || completed === tasks.length) {
          onProgress?.({
            phase: 'tcp',
            completed,
            total: tasks.length,
            foundHosts: devices.size,
            foundServices: 0,
          });
        }
      }
    };

    await Promise.all(
      Array.from({length: NETWORK_SCAN_CONCURRENCY}, worker),
    );

    console.log('[SWEEPER][WIFI][TCP] complete');
  };

  const mdnsScan = async () => {
    console.log('[SWEEPER][WIFI][MDNS] starting');

    const discoveries = await scanBonjourServices(
      (completedTypes, totalTypes, serviceCount) => {
        onProgress?.({
          phase: 'mdns',
          completed: completedTypes,
          total: totalTypes,
          foundHosts: devices.size,
          foundServices: serviceCount,
        });
      },
    );

    for (const item of discoveries) {
      const key = keyForBonjour(item);
      if (!key) continue;

      const deviceKey = item.ipv4 || key;
      const device = getDevice(deviceKey, item.ipv4 || item.ipv6 || key);

      if (item.hostname) device.hostname = item.hostname;

      device.bonjourServices.push({
        type: item.type,
        name: item.name,
        hostname: item.hostname,
        port: item.port,
      });

      addSource(device.discoverySources, 'mdns');

      console.log(
        `[SWEEPER][WIFI][MDNS] ip=${item.ipv4 || item.ipv6 || 'unknown'} name=${item.name || 'unknown'} type=${item.type} port=${item.port || 0}`,
      );
    }

    console.log(
      `[SWEEPER][WIFI][MDNS] complete services=${discoveries.length}`,
    );
  };

  const ssdpScan = async () => {
    console.log('[SWEEPER][WIFI][SSDP] starting M-SEARCH');
    onProgress?.({
      phase: 'ssdp',
      completed: 0,
      total: 1,
      foundHosts: devices.size,
      foundServices: 0,
    });

    try {
      const discoveries = await scanSsdp(3500);

      for (const item of discoveries) {
        const device = getDevice(item.ip, item.ip);
        device.ssdpServices.push({
          st: item.st,
          usn: item.usn,
          location: item.location,
          server: item.server,
        });
        addSource(device.discoverySources, 'ssdp');

        console.log(
          `[SWEEPER][WIFI][SSDP] ip=${item.ip} st=${item.st || ''} server=${item.server || ''} location=${item.location || ''}`,
        );
      }

      onProgress?.({
        phase: 'ssdp',
        completed: 1,
        total: 1,
        foundHosts: devices.size,
        foundServices: discoveries.length,
      });

      console.log(
        `[SWEEPER][WIFI][SSDP] complete responses=${discoveries.length}`,
      );
    } catch (error) {
      console.warn(
        `[SWEEPER][WIFI][SSDP] failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  await Promise.all([tcpScan(), mdnsScan(), ssdpScan()]);

  const results = [...devices.values()]
    .map(classify)
    .sort(
      (a, b) =>
        b.suspicionScore - a.suspicionScore ||
        a.ip.localeCompare(b.ip),
    );

  console.log(
    `[SWEEPER][WIFI] complete devices=${results.length} review=${results.filter(
      item => item.suspicionScore >= 20,
    ).length}`,
  );

  return results;
}
