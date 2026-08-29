import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { normalizePlayerName, sanitizeInput, type ClientMessage, type ServerMessage } from '../net/protocol';
import { LocalRoom } from './room';

export const DEFAULT_PORT = 8080;
const DIST_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') { res.writeHead(405); res.end('Method Not Allowed'); return; }
  const rawPath = (req.url ?? '/').split('?')[0] ?? '/';
  if (rawPath === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let path: string;
  try { path = decodeURIComponent(rawPath); } catch { res.writeHead(400); res.end('Bad Request'); return; }
  const relative = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  const filePath = resolve(DIST_DIR, relative);
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${sep}`)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) { res.writeHead(404); res.end('Build not found. Run npm run build first.'); return; }
  const stat = statSync(filePath);
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream', 'Content-Length': stat.size });
  if (method === 'HEAD') res.end(); else createReadStream(filePath).pipe(res);
}

export function createIronViperServer(port: number): { server: HttpServer; close: () => Promise<void> } {
  const room = new LocalRoom();
  const server = createHttpServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, perMessageDeflate: { threshold: 512 } });
  const contexts = new Map<WebSocket, number>();

  wss.on('connection', (ws, request) => {
    request.socket.setNoDelay(true);
    let joined = false;
    let messages = 0;
    let windowStart = Date.now();
    const joinTimer = setTimeout(() => { if (!joined) ws.close(1008, 'join timeout'); }, 10_000);
    ws.on('error', () => {});
    ws.on('message', (data: RawData) => {
      const now = Date.now();
      if (now - windowStart > 1000) { windowStart = now; messages = 0; }
      if (++messages > 120) { ws.close(1008, 'rate limit'); return; }
      let message: ClientMessage;
      try { message = JSON.parse(data.toString()) as ClientMessage; } catch { return; }
      if (!joined) {
        if (message.t !== 'joinLocal') { ws.close(1008, 'join required'); return; }
        const index = room.join(ws, normalizePlayerName(message.name));
        if (index === null) {
          const error: ServerMessage = { t: 'error', code: 'room_full', message: '本地小队已满或任务已经开始' };
          ws.send(JSON.stringify(error)); ws.close(1008, 'room unavailable'); return;
        }
        contexts.set(ws, index); joined = true; clearTimeout(joinTimer); return;
      }
      const index = contexts.get(ws);
      if (index === undefined) return;
      if (message.t === 'ready') room.setReady(index, !!message.ready);
      else if (message.t === 'start') room.start(index);
      else if (message.t === 'restart') room.restart(index);
      else if (message.t === 'input') {
        const input = sanitizeInput(message.input);
        if (input) room.setInput(index, input);
      }
    });
    ws.on('close', () => { clearTimeout(joinTimer); contexts.delete(ws); room.leave(ws); });
  });

  server.listen(port, '0.0.0.0', () => {
    const addresses = new Set<string>([`http://localhost:${port}`]);
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === 'IPv4' && !entry.internal) addresses.add(`http://${entry.address}:${port}/?local`);
      }
    }
    console.log('\nOPERATION: IRON VIPER — LAN SERVER');
    for (const address of addresses) console.log(`  ${address}`);
    console.log('\nShare the ?local address with players on the same Wi-Fi.\n');
  });

  return {
    server,
    close: () => new Promise((resolveClose) => {
      room.shutdown();
      wss.close(() => server.close(() => resolveClose()));
    }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  createIronViperServer(port);
}
