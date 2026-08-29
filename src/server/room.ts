import type { WebSocket } from 'ws';
import { EMPTY_INPUT, SNAPSHOT_RATE, TICK_RATE } from '../core/constants';
import type { InputState } from '../core/types';
import { createGame, type GameState } from '../game/state';
import { updateGame } from '../game/update';
import type { LobbyPlayer, ServerMessage } from '../net/protocol';

interface Slot {
  ws: WebSocket;
  index: number;
  name: string;
  ready: boolean;
  input: InputState;
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

export class LocalRoom {
  private readonly slots = new Map<number, Slot>();
  private game: GameState | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshotSequence = 0;
  private snapshotEvery = Math.max(1, Math.round(TICK_RATE / SNAPSHOT_RATE));

  join(ws: WebSocket, name: string): number | null {
    if (this.game || this.slots.size >= 4) return null;
    let index = 0;
    while (this.slots.has(index) && index < 4) index++;
    if (index >= 4) return null;
    this.slots.set(index, { ws, index, name, ready: false, input: { ...EMPTY_INPUT } });
    send(ws, { t: 'welcome', playerIndex: index });
    this.broadcastLobby();
    return index;
  }

  leave(ws: WebSocket): void {
    for (const [index, slot] of this.slots) {
      if (slot.ws === ws) {
        if (this.game) {
          slot.input = { ...EMPTY_INPUT };
          slot.name = `${slot.name.slice(0, 7)} LOST`;
        } else {
          this.slots.delete(index);
          this.compactLobbySlots();
        }
        break;
      }
    }
    if (this.game && ![...this.slots.values()].some((slot) => slot.ws.readyState === 1)) {
      this.slots.clear();
      this.stop();
      return;
    }
    this.broadcastLobby();
    if (this.slots.size === 0) this.stop();
  }

  setReady(index: number, ready: boolean): void {
    const slot = this.slots.get(index);
    if (!slot || this.game) return;
    slot.ready = ready;
    this.broadcastLobby();
  }

  setInput(index: number, input: InputState): void {
    const slot = this.slots.get(index);
    if (slot) slot.input = input;
  }

  start(index: number): boolean {
    if (this.game || index !== this.hostIndex() || !this.canStart()) return false;
    this.game = createGame(this.slots.size, (Date.now() ^ 0x51f15e) >>> 0);
    this.startLoop();
    this.broadcastLobby();
    this.broadcastSnapshot();
    return true;
  }

  restart(index: number): boolean {
    if (!this.game || index !== this.hostIndex()) return false;
    this.game = createGame(this.slots.size, (Date.now() ^ 0xa71ce) >>> 0);
    for (const slot of this.slots.values()) slot.input = { ...EMPTY_INPUT };
    this.broadcastSnapshot();
    return true;
  }

  shutdown(): void { this.stop(); }

  private startLoop(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.game) return;
      const inputs = Array.from({ length: this.game.playerCount }, (_, index) => this.slots.get(index)?.input ?? { ...EMPTY_INPUT });
      updateGame(this.game, inputs);
      if (this.game.tick % this.snapshotEvery === 0 || this.game.events.length > 0) this.broadcastSnapshot();
    }, 1000 / TICK_RATE);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.game = null;
  }

  private hostIndex(): number {
    return Math.min(...this.slots.keys());
  }

  private compactLobbySlots(): void {
    if (this.game) return;
    const ordered = [...this.slots.values()].sort((a, b) => a.index - b.index);
    this.slots.clear();
    ordered.forEach((slot, index) => {
      slot.index = index;
      this.slots.set(index, slot);
      send(slot.ws, { t: 'welcome', playerIndex: index });
    });
  }

  private canStart(): boolean {
    return this.slots.size > 0 && [...this.slots.values()].every((slot) => slot.ready);
  }

  private lobbyPlayers(): LobbyPlayer[] {
    const host = this.hostIndex();
    return [...this.slots.values()].map((slot) => ({
      index: slot.index,
      name: slot.name,
      ready: slot.ready,
      host: slot.index === host,
      connected: slot.ws.readyState === 1,
    }));
  }

  private broadcastLobby(): void {
    const message: ServerMessage = { t: 'lobby', players: this.lobbyPlayers(), canStart: this.canStart(), inGame: !!this.game };
    for (const slot of this.slots.values()) send(slot.ws, message);
  }

  private broadcastSnapshot(): void {
    if (!this.game) return;
    const names = Array.from({ length: this.game.playerCount }, (_, index) => this.slots.get(index)?.name ?? `VIPER ${index + 1}`);
    const message: ServerMessage = { t: 'snapshot', seq: ++this.snapshotSequence, state: this.game, names };
    for (const slot of this.slots.values()) send(slot.ws, message);
  }
}
