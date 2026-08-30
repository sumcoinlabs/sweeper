import TcpSocket from 'react-native-tcp-socket';
import {NetworkInfo} from 'react-native-network-info';
import {
  NETWORK_PROBE_TIMEOUT_MS,
  NETWORK_SCAN_CONCURRENCY,
  NETWORK_SCAN_PORTS,
} from '../config';
import type {NetworkDevice} from '../types';

type Progress = {completed: number; total: number; foundHosts: number};

type Task = {host: string; port: number};

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
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
      try { socket?.destroy(); } catch {}
      resolve(open);
    };

    const timer = setTimeout(() => finish(false), NETWORK_PROBE_TIMEOUT_MS + 80);

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

function classify(ip: string, openPorts: number[]): NetworkDevice {
  let suspicionScore = 0;
  const reasons: string[] = [];

  const rtsp = openPorts.filter(port => port === 554 || port === 8554);
  const dvr = openPorts.filter(port => port === 37777 || port === 34567);
  const embedded = openPorts.filter(port => [8000, 8080, 8899].includes(port));

  if (rtsp.length) {
    suspicionScore += 28;
    reasons.push(`RTSP-associated port open: ${rtsp.join(', ')}`);
  }
  if (dvr.length) {
    suspicionScore += 22;
    reasons.push(`DVR/IP-camera-associated port open: ${dvr.join(', ')}`);
  }
  if (embedded.length) {
    suspicionScore += 4;
    reasons.push(`Embedded-device service port open: ${embedded.join(', ')}`);
  }
  if ((openPorts.includes(80) || openPorts.includes(443)) && reasons.length === 0) {
    suspicionScore += 1;
    reasons.push('Web administration service detected; device type is unknown.');
  }

  return {ip, openPorts, suspicionScore, reasons};
}

export async function scanLocalNetwork(
  onProgress?: (progress: Progress) => void,
): Promise<NetworkDevice[]> {
  const ip = String(await NetworkInfo.getIPV4Address());
  if (!ip || !isPrivateIpv4(ip)) {
    throw new Error(`Sweeper only scans the current private LAN. Current IPv4: ${ip || 'unavailable'}`);
  }

  const parts = ip.split('.');
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const tasks: Task[] = [];
  for (let host = 1; host <= 254; host += 1) {
    const candidate = `${prefix}.${host}`;
    if (candidate === ip) continue;
    for (const port of NETWORK_SCAN_PORTS) tasks.push({host: candidate, port});
  }

  const openByHost = new Map<string, number[]>();
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      const task = tasks[index];
      const open = await probe(task.host, task.port);
      if (open) {
        const ports = openByHost.get(task.host) || [];
        ports.push(task.port);
        openByHost.set(task.host, ports);
      }
      completed += 1;
      if (completed % 20 === 0 || completed === tasks.length) {
        onProgress?.({completed, total: tasks.length, foundHosts: openByHost.size});
      }
    }
  };

  await Promise.all(Array.from({length: NETWORK_SCAN_CONCURRENCY}, worker));

  return [...openByHost.entries()]
    .map(([host, ports]) => classify(host, [...new Set(ports)].sort((a, b) => a - b)))
    .sort((a, b) => b.suspicionScore - a.suspicionScore || a.ip.localeCompare(b.ip));
}
