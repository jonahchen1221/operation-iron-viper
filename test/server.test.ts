import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import WebSocket from 'ws';
import type { ServerMessage } from '../src/net/protocol';
import { createIronViperServer } from '../src/server/server';

function nextMessage(ws: WebSocket, type: ServerMessage['t'], timeout = 2500): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${type}`)); }, timeout);
    const onMessage = (raw: WebSocket.RawData) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      if (message.t !== type) return;
      cleanup(); resolve(message);
    };
    const cleanup = () => { clearTimeout(timer); ws.off('message', onMessage); };
    ws.on('message', onMessage);
  });
}

test('two LAN clients can join, ready up and receive an authoritative game', async () => {
  const instance = createIronViperServer(0);
  if (!instance.server.listening) await once(instance.server, 'listening');
  const address = instance.server.address();
  assert.ok(address && typeof address === 'object');
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const first = new WebSocket(url);
  const second = new WebSocket(url);
  await Promise.all([once(first, 'open'), once(second, 'open')]);

  const firstWelcome = nextMessage(first, 'welcome');
  first.send(JSON.stringify({ t: 'joinLocal', name: 'ALPHA' }));
  assert.equal((await firstWelcome as Extract<ServerMessage, { t: 'welcome' }>).playerIndex, 0);
  const secondWelcome = nextMessage(second, 'welcome');
  second.send(JSON.stringify({ t: 'joinLocal', name: 'BRAVO' }));
  assert.equal((await secondWelcome as Extract<ServerMessage, { t: 'welcome' }>).playerIndex, 1);

  first.send(JSON.stringify({ t: 'ready', ready: true }));
  second.send(JSON.stringify({ t: 'ready', ready: true }));
  await new Promise((resolve) => setTimeout(resolve, 25));
  const snapshot = nextMessage(first, 'snapshot');
  first.send(JSON.stringify({ t: 'start' }));
  const started = await snapshot as Extract<ServerMessage, { t: 'snapshot' }>;
  assert.equal(started.state.playerCount, 2);
  assert.deepEqual(started.names, ['ALPHA', 'BRAVO']);

  first.close(); second.close();
  await Promise.all([once(first, 'close'), once(second, 'close')]);
  await instance.close();
});
