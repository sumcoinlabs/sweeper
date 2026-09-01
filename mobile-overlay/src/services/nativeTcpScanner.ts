import {NativeModules, Platform} from 'react-native';
import TcpSocket from 'react-native-tcp-socket';

export type TcpOpenResult = {
  ip: string;
  port: number;
};

type NativeNetworkModule = {
  scanTcpTargets(targets: string[], timeoutMs: number): Promise<unknown>;
  exchangeTcp(
    host: string,
    port: number,
    payload: string,
    timeoutMs: number,
  ): Promise<unknown>;
};

const nativeModule = NativeModules.SweeperSSDP as
  | NativeNetworkModule
  | undefined;

function fallbackProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.destroy();
      } catch {}
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs + 100);

    try {
      socket = TcpSocket.createConnection(
        {host, port, connectTimeout: timeoutMs},
        () => finish(true),
      );
      socket.on('error', () => finish(false));
      socket.on('timeout', () => finish(false));
    } catch {
      finish(false);
    }
  });
}

export async function scanTcpTargets(
  targets: string[],
  timeoutMs = 400,
): Promise<TcpOpenResult[]> {
  if (Platform.OS === 'ios' && nativeModule?.scanTcpTargets) {
    const raw = await nativeModule.scanTcpTargets(targets, timeoutMs);
    if (!Array.isArray(raw)) return [];

    return raw
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const ip = typeof row.ip === 'string' ? row.ip : '';
        const port = Number(row.port);
        return ip && Number.isFinite(port) ? {ip, port} : null;
      })
      .filter((item): item is TcpOpenResult => item !== null);
  }

  const output: TcpOpenResult[] = [];
  let cursor = 0;

  await Promise.all(
    Array.from({length: 32}, async () => {
      while (true) {
        const index = cursor++;
        if (index >= targets.length) return;

        const [host, portText] = targets[index].split(':');
        const port = Number(portText);
        if (!host || !Number.isFinite(port)) continue;

        if (await fallbackProbe(host, port, timeoutMs)) {
          output.push({ip: host, port});
        }
      }
    }),
  );

  return output;
}

function fallbackExchange(
  host: string,
  port: number,
  payload: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise(resolve => {
    let settled = false;
    let output = '';
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.destroy();
      } catch {}
      resolve(output.slice(0, 8192));
    };

    const timer = setTimeout(finish, timeoutMs + 200);

    try {
      socket = TcpSocket.createConnection(
        {host, port, connectTimeout: timeoutMs},
        () => {
          try {
            socket?.write(payload);
          } catch {
            finish();
          }
        },
      );
      socket.on('data', chunk => {
        output += chunk.toString();
        if (output.length >= 8192) finish();
      });
      socket.on('error', finish);
      socket.on('timeout', finish);
      socket.on('close', finish);
    } catch {
      finish();
    }
  });
}

export async function exchangeTcp(
  host: string,
  port: number,
  payload: string,
  timeoutMs = 1000,
): Promise<string> {
  if (Platform.OS === 'ios' && nativeModule?.exchangeTcp) {
    const raw = await nativeModule.exchangeTcp(
      host,
      port,
      payload,
      timeoutMs,
    );
    return typeof raw === 'string' ? raw : '';
  }

  return fallbackExchange(host, port, payload, timeoutMs);
}
