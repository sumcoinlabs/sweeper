import {NetworkInfo} from 'react-native-network-info';
import {
  NETWORK_PROBE_TIMEOUT_MS,
  NETWORK_SCAN_CONCURRENCY,
} from '../config';
import type {
  BonjourServiceFinding,
  NetworkAssessment,
  NetworkDevice,
  NetworkFingerprint,
  SsdpServiceFinding,
} from '../types';
import {
  ensureLocalNetworkPermission,
  scanBonjourServices,
  type BonjourDiscovery,
} from './bonjourScanner';
import {scanIcmpSubnet} from './icmpScanner';
import {exchangeTcp, scanTcpTargets} from './nativeTcpScanner';
import {scanSsdp} from './ssdpScanner';

type Progress = {
  phase: 'icmp' | 'tcp' | 'fingerprint' | 'mdns' | 'ssdp';
  completed: number;
  total: number;
  foundHosts: number;
  foundServices: number;
};

type Task = {host: string; port: number; timeoutMs: number};

type MutableDevice = {
  ip: string;
  hostname?: string;
  icmpResponsive: boolean;
  icmpRttMs?: number;
  openPorts: number[];
  bonjourServices: BonjourServiceFinding[];
  ssdpServices: SsdpServiceFinding[];
  fingerprints: NetworkFingerprint[];
  discoverySources: Array<'icmp' | 'tcp' | 'mdns' | 'ssdp'>;
};

const BASELINE_PORTS = [80, 443, 554, 8000, 8080, 8554, 8899, 9000, 37777, 34567] as const;

const EXPANDED_LIVE_HOST_PORTS = [
  22, 53, 81, 82, 83, 88, 443, 554, 1080, 1935, 2020, 3333,
  5000, 7000, 7100, 7447, 8000, 8001, 8080, 8081, 8443, 8554,
  8888, 8899, 9000, 9001, 9091, 10000, 10400, 10554, 10600,
  37777, 34567, 49152,
] as const;

const HTTP_PORTS = new Set([
  80, 81, 82, 83, 5000, 7000, 8000, 8001, 8080, 8081,
  8888, 8899, 9000, 9001, 9091,
]);

const RTSP_PORTS = new Set([554, 8554, 10554]);

const directCameraServiceTypes = new Set([
  '_rtsp._tcp',
  '_axis-video._tcp',
  '_axis-nvr._tcp',
  '_vapix-http._tcp',
  '_vapix-https._tcp',
]);

const cameraTextHints = [
  'camera', 'ip camera', 'ipcam', 'network camera', 'nvr', 'dvr',
  'onvif', 'axis', 'hikvision', 'dahua', 'reolink', 'amcrest',
  'foscam', 'eufy', 'wyze', 'arlo', 'ring', 'ezviz', 'tapo',
  'vstarcam', 'wansview', 'lorex', 'swann',
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

function isIpv4(ip: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip);
}

function addSource(
  sources: Array<'icmp' | 'tcp' | 'mdns' | 'ssdp'>,
  source: 'icmp' | 'tcp' | 'mdns' | 'ssdp',
) {
  if (!sources.includes(source)) sources.push(source);
}

function includesCameraHint(text: string): boolean {
  const lower = text.toLowerCase();
  return cameraTextHints.some(hint => lower.includes(hint));
}

function httpFingerprint(
  port: number,
  response: string,
): NetworkFingerprint | null {
  if (!response.trim()) return null;

  const status =
    response.match(/^HTTP\/\d(?:\.\d)?\s+[^\r\n]+/im)?.[0]?.trim();
  const server =
    response.match(/^Server:\s*([^\r\n]+)/im)?.[1]?.trim();
  const realm =
    response.match(/^WWW-Authenticate:\s*([^\r\n]+)/im)?.[1]?.trim();
  const powered =
    response.match(/^X-Powered-By:\s*([^\r\n]+)/im)?.[1]?.trim();
  const title =
    response.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1]?.trim();

  const pieces = [
    status,
    server ? `Server=${server}` : undefined,
    realm ? `Auth=${realm}` : undefined,
    powered ? `PoweredBy=${powered}` : undefined,
    title ? `Title=${title}` : undefined,
  ].filter(Boolean) as string[];

  const summary = pieces.join(' · ').slice(0, 500);
  if (!summary) return null;

  return {
    protocol: 'http',
    port,
    summary,
    cameraHint: includesCameraHint(summary),
    confirmed: Boolean(status),
  };
}

function rtspFingerprint(
  port: number,
  response: string,
): NetworkFingerprint | null {
  if (!response.trim()) return null;

  const status =
    response.match(/^RTSP\/\d(?:\.\d)?\s+[^\r\n]+/im)?.[0]?.trim();
  const publicMethods =
    response.match(/^Public:\s*([^\r\n]+)/im)?.[1]?.trim();
  const server =
    response.match(/^Server:\s*([^\r\n]+)/im)?.[1]?.trim();

  const confirmed = Boolean(status);
  const pieces = [
    status,
    publicMethods ? `Public=${publicMethods}` : undefined,
    server ? `Server=${server}` : undefined,
  ].filter(Boolean) as string[];

  const summary = pieces.join(' · ').slice(0, 500);
  if (!summary) return null;

  return {
    protocol: 'rtsp',
    port,
    summary,
    cameraHint: confirmed || includesCameraHint(summary),
    confirmed,
  };
}

function buildNetworkAssessment(
  device: MutableDevice,
): NetworkAssessment {
  const confirmedRtsp = device.fingerprints.filter(
    fingerprint =>
      fingerprint.protocol === 'rtsp' &&
      fingerprint.confirmed,
  );

  const cameraHttp = device.fingerprints.filter(
    fingerprint =>
      fingerprint.protocol === 'http' &&
      fingerprint.cameraHint,
  );

  const cameraBonjour = device.bonjourServices.filter(
    service => directCameraServiceTypes.has(service.type),
  );

  const cameraSsdp = device.ssdpServices.filter(service =>
    includesCameraHint(
      [
        service.st || '',
        service.usn || '',
        service.server || '',
        service.location || '',
      ].join(' '),
    ),
  );

  const mediaBonjour = device.bonjourServices.some(service =>
    ['_airplay._tcp', '_googlecast._tcp'].includes(service.type),
  );

  const evidenceCodes: string[] = [];

  if (confirmedRtsp.length > 0) {
    evidenceCodes.push('RTSP_CONFIRMED');

    if (device.openPorts.includes(554)) {
      evidenceCodes.push('RTSP_STANDARD_PORT_554');
    }

    if (
      device.openPorts.some(port =>
        [10400, 10600, 37777, 34567].includes(port),
      )
    ) {
      evidenceCodes.push('VIDEO_DEVICE_PORT_PATTERN');
    }

    return {
      category: 'network_video',
      evidenceLevel: 'strong',
      userTitle: 'Possible IP camera or video recorder',
      userSummary:
        'This device responded to a standard network video-streaming protocol. That is strong evidence of network video equipment, such as an IP security camera or video recorder, but Wi-Fi alone cannot tell whether it is hidden or improperly placed.',
      backendReview: true,
      networkOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (cameraHttp.length > 0) {
    evidenceCodes.push('CAMERA_HTTP_FINGERPRINT');

    return {
      category: 'camera_security',
      evidenceLevel: 'strong',
      userTitle: 'Possible camera or security device',
      userSummary:
        'This device returned a network fingerprint associated with camera or security equipment. Sweeper still needs physical or additional evidence before treating it as a possible hidden-camera threat.',
      backendReview: true,
      networkOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (cameraBonjour.length > 0 || cameraSsdp.length > 0) {
    if (cameraBonjour.length > 0) {
      evidenceCodes.push('CAMERA_SERVICE_ADVERTISEMENT');
    }

    if (cameraSsdp.length > 0) {
      evidenceCodes.push('CAMERA_UPNP_HINT');
    }

    return {
      category: 'camera_security',
      evidenceLevel: 'moderate',
      userTitle: 'Camera-related network device',
      userSummary:
        'This device advertises a service associated with camera or security equipment. That is a useful clue, not proof of a hidden camera.',
      backendReview: true,
      networkOnlyThreatEligible: false,
      evidenceCodes,
    };
  }

  if (mediaBonjour) {
    return {
      category: 'media',
      evidenceLevel: 'none',
      userTitle: 'Media device',
      userSummary:
        'This looks like a normal media or casting device and is not a camera warning by itself.',
      backendReview: false,
      networkOnlyThreatEligible: false,
      evidenceCodes: ['MEDIA_SERVICE'],
    };
  }

  if (device.icmpResponsive || device.openPorts.length > 0) {
    return {
      category: 'other',
      evidenceLevel: 'none',
      userTitle: 'Other network device',
      userSummary:
        'Sweeper found this device on the local network but did not find camera-specific evidence.',
      backendReview: false,
      networkOnlyThreatEligible: false,
      evidenceCodes: ['NETWORK_DEVICE_ONLY'],
    };
  }

  return {
    category: 'unknown',
    evidenceLevel: 'none',
    userTitle: 'Unknown network service',
    userSummary:
      'Sweeper found a network service but did not find camera-specific evidence.',
    backendReview: false,
    networkOnlyThreatEligible: false,
    evidenceCodes: [],
  };
}

function classify(device: MutableDevice): NetworkDevice {
  let suspicionScore = 0;
  const reasons: string[] = [];

  const rtsp = device.openPorts.filter(port => RTSP_PORTS.has(port));
  const dvr = device.openPorts.filter(
    port => port === 37777 || port === 34567,
  );
  const embedded = device.openPorts.filter(port =>
    [8000, 8080, 8899].includes(port),
  );

  const confirmedRtsp = device.fingerprints.filter(
    fingerprint =>
      fingerprint.protocol === 'rtsp' &&
      fingerprint.confirmed,
  );

  const cameraHttp = device.fingerprints.filter(
    fingerprint =>
      fingerprint.protocol === 'http' &&
      fingerprint.cameraHint,
  );

  if (confirmedRtsp.length) {
    suspicionScore = Math.max(suspicionScore, 38);
    reasons.push(
      `RTSP protocol confirmed on port(s): ${confirmedRtsp
        .map(item => item.port)
        .join(', ')}`,
    );
  } else if (rtsp.length) {
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

  if (cameraHttp.length) {
    suspicionScore = Math.max(suspicionScore, 26);
    reasons.push(
      'HTTP fingerprint contains a camera, recorder or security-vendor hint.',
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

  if (
    device.bonjourServices.some(
      service => service.type === '_hap._tcp',
    )
  ) {
    reasons.push(
      'HomeKit accessory advertised. HomeKit alone does not identify a camera.',
    );
  }

  if (
    device.bonjourServices.some(service =>
      ['_airplay._tcp', '_googlecast._tcp'].includes(service.type),
    )
  ) {
    reasons.push(
      'Common media-device service advertised; this is informational, not camera evidence.',
    );
  }

  if (
    device.icmpResponsive &&
    device.openPorts.length === 0 &&
    device.bonjourServices.length === 0 &&
    device.ssdpServices.length === 0
  ) {
    reasons.push(
      'Live LAN host responded to ICMP. Host presence alone is not camera evidence.',
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
    assessment: buildNetworkAssessment(device),
    ip: device.ip,
    hostname: device.hostname,
    icmpResponsive: device.icmpResponsive,
    icmpRttMs: device.icmpRttMs,
    openPorts: [...new Set(device.openPorts)].sort((a, b) => a - b),
    bonjourServices: device.bonjourServices,
    ssdpServices: device.ssdpServices,
    fingerprints: device.fingerprints,
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
      icmpResponsive: false,
      openPorts: [],
      bonjourServices: [],
      ssdpServices: [],
      fingerprints: [],
      discoverySources: [],
    };
    devices.set(key, created);
    return created;
  };

  const parts = ip.split('.');
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const mdnsPromise = (async () => {
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
      const device = getDevice(
        deviceKey,
        item.ipv4 || item.ipv6 || key,
      );

      if (item.hostname) device.hostname = item.hostname;

      device.bonjourServices.push({
        type: item.type,
        name: item.name,
        hostname: item.hostname,
        port: item.port,
      });

      addSource(device.discoverySources, 'mdns');

      console.log(
        `[SWEEPER][WIFI][MDNS] ip=${
          item.ipv4 || item.ipv6 || 'unknown'
        } name=${item.name || 'unknown'} type=${item.type} port=${
          item.port || 0
        }`,
      );
    }

    console.log(
      `[SWEEPER][WIFI][MDNS] complete services=${discoveries.length}`,
    );
  })();

  const ssdpPromise = (async () => {
    console.log('[SWEEPER][WIFI][SSDP] starting M-SEARCH');

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
          `[SWEEPER][WIFI][SSDP] ip=${item.ip} st=${
            item.st || ''
          } server=${item.server || ''} location=${
            item.location || ''
          }`,
        );
      }

      console.log(
        `[SWEEPER][WIFI][SSDP] complete responses=${discoveries.length}`,
      );
    } catch (error) {
      console.warn(
        `[SWEEPER][WIFI][SSDP] unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  })();

  onProgress?.({
    phase: 'icmp',
    completed: 0,
    total: 1,
    foundHosts: devices.size,
    foundServices: 0,
  });

  let icmpHosts: string[] = [];

  try {
    console.log('[SWEEPER][WIFI][ICMP] starting /24 host discovery');
    const icmp = await scanIcmpSubnet(ip, 3600);
    icmpHosts = icmp.map(item => item.ip);

    for (const item of icmp) {
      const device = getDevice(item.ip, item.ip);
      device.icmpResponsive = true;
      device.icmpRttMs = item.rttMs;
      addSource(device.discoverySources, 'icmp');

      console.log(
        `[SWEEPER][WIFI][ICMP] ip=${item.ip} rtt=${
          item.rttMs ?? 'unknown'
        }ms`,
      );
    }

    console.log(
      `[SWEEPER][WIFI][ICMP] complete hosts=${icmpHosts.length}`,
    );
  } catch (error) {
    console.warn(
      `[SWEEPER][WIFI][ICMP] unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  onProgress?.({
    phase: 'icmp',
    completed: 1,
    total: 1,
    foundHosts: devices.size,
    foundServices: icmpHosts.length,
  });

  const taskMap = new Map<string, Task>();

  const addTask = (host: string, port: number, timeoutMs: number) => {
    if (host === ip) return;
    taskMap.set(`${host}:${port}`, {host, port, timeoutMs});
  };

  for (let host = 1; host <= 254; host += 1) {
    const candidate = `${prefix}.${host}`;
    for (const port of BASELINE_PORTS) {
      addTask(candidate, port, NETWORK_PROBE_TIMEOUT_MS);
    }
  }

  for (const host of icmpHosts) {
    for (const port of EXPANDED_LIVE_HOST_PORTS) {
      addTask(
        host,
        port,
        Math.max(NETWORK_PROBE_TIMEOUT_MS, 420),
      );
    }
  }

  const tasks = [...taskMap.values()];
  const targetStrings = tasks.map(
    task => `${task.host}:${task.port}`,
  );

  console.log(
    `[SWEEPER][WIFI][TCP] starting probes=${targetStrings.length} icmpHosts=${icmpHosts.length}`,
  );

  onProgress?.({
    phase: 'tcp',
    completed: 0,
    total: targetStrings.length,
    foundHosts: devices.size,
    foundServices: 0,
  });

  const openTargets = await scanTcpTargets(
    targetStrings,
    400,
  );

  for (const result of openTargets) {
    const device = getDevice(result.ip, result.ip);
    device.openPorts.push(result.port);
    addSource(device.discoverySources, 'tcp');

    console.log(
      `[SWEEPER][WIFI][TCP] ${result.ip}:${result.port} open`,
    );
  }

  onProgress?.({
    phase: 'tcp',
    completed: targetStrings.length,
    total: targetStrings.length,
    foundHosts: devices.size,
    foundServices: openTargets.length,
  });

  console.log(
    `[SWEEPER][WIFI][TCP] complete open=${openTargets.length}`,
  );

  const fingerprintCandidates = [...devices.values()].filter(
    device =>
      isIpv4(device.ip) &&
      device.openPorts.some(
        port => HTTP_PORTS.has(port) || RTSP_PORTS.has(port),
      ),
  );

  let fingerprintCompleted = 0;

  onProgress?.({
    phase: 'fingerprint',
    completed: 0,
    total: fingerprintCandidates.length || 1,
    foundHosts: devices.size,
    foundServices: 0,
  });

  for (const device of fingerprintCandidates) {
    for (const port of device.openPorts) {
      if (RTSP_PORTS.has(port)) {
        const response = await exchangeTcp(
          device.ip,
          port,
          `OPTIONS rtsp://${device.ip}:${port}/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Sweeper/0.1\r\n\r\n`,
          1000,
        );

        const fingerprint = rtspFingerprint(port, response);
        if (fingerprint) {
          device.fingerprints.push(fingerprint);
          console.log(
            `[SWEEPER][WIFI][FINGERPRINT][RTSP] ip=${
              device.ip
            } port=${port} confirmed=${
              fingerprint.confirmed ? 'yes' : 'no'
            } summary=${fingerprint.summary}`,
          );
        }
      }

      if (HTTP_PORTS.has(port)) {
        const response = await exchangeTcp(
          device.ip,
          port,
          `GET / HTTP/1.1\r\nHost: ${device.ip}\r\nUser-Agent: Sweeper/0.1\r\nAccept: text/html,*/*;q=0.5\r\nConnection: close\r\n\r\n`,
          900,
        );

        const fingerprint = httpFingerprint(port, response);
        if (fingerprint) {
          device.fingerprints.push(fingerprint);
          console.log(
            `[SWEEPER][WIFI][FINGERPRINT][HTTP] ip=${
              device.ip
            } port=${port} cameraHint=${
              fingerprint.cameraHint ? 'yes' : 'no'
            } summary=${fingerprint.summary}`,
          );
        }
      }
    }

    fingerprintCompleted += 1;

    onProgress?.({
      phase: 'fingerprint',
      completed: fingerprintCompleted,
      total: fingerprintCandidates.length || 1,
      foundHosts: devices.size,
      foundServices: device.fingerprints.length,
    });
  }

  await Promise.all([mdnsPromise, ssdpPromise]);

  const results = [...devices.values()]
    .map(classify)
    .sort((a, b) => {
      if (b.suspicionScore !== a.suspicionScore) {
        return b.suspicionScore - a.suspicionScore;
      }
      if (isIpv4(a.ip) && !isIpv4(b.ip)) return -1;
      if (!isIpv4(a.ip) && isIpv4(b.ip)) return 1;
      return a.ip.localeCompare(b.ip, undefined, {numeric: true});
    });

  const ipv4Hosts = results.filter(device => isIpv4(device.ip)).length;
  const icmpCount = results.filter(device => device.icmpResponsive).length;
  const rtspConfirmed = results.filter(device =>
    device.fingerprints?.some(
      fingerprint =>
        fingerprint.protocol === 'rtsp' &&
        fingerprint.confirmed,
    ),
  ).length;

  console.log(
    `[SWEEPER][WIFI] complete records=${results.length} ipv4Hosts=${ipv4Hosts} icmp=${icmpCount} rtspConfirmed=${rtspConfirmed} review=${results.filter(
      item => item.suspicionScore >= 20,
    ).length}`,
  );

  return results;
}
