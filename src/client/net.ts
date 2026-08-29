import type { InputState } from '../core/types';
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../net/protocol';
import type { GameState } from '../game/state';

export interface NetworkHandlers {
  onWelcome: (playerIndex: number) => void;
  onLobby: (players: LobbyPlayer[], canStart: boolean, inGame: boolean) => void;
  onSnapshot: (state: GameState, names: string[]) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export class NetworkClient {
  private socket: WebSocket | null = null;
  private inputSequence = 0;

  constructor(private readonly handlers: NetworkHandlers) {}

  connect(name: string): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener('open', () => this.send({ t: 'joinLocal', name }));
    socket.addEventListener('message', (event) => this.receive(event.data));
    socket.addEventListener('close', () => this.handlers.onClose());
    socket.addEventListener('error', () => this.handlers.onError('无法连接本地作战服务器'));
  }

  setReady(ready: boolean): void { this.send({ t: 'ready', ready }); }
  start(): void { this.send({ t: 'start' }); }
  restart(): void { this.send({ t: 'restart' }); }
  sendInput(input: InputState): void { this.send({ t: 'input', seq: ++this.inputSequence, input }); }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private receive(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let message: ServerMessage;
    try { message = JSON.parse(raw) as ServerMessage; } catch { return; }
    if (message.t === 'welcome') this.handlers.onWelcome(message.playerIndex);
    else if (message.t === 'lobby') this.handlers.onLobby(message.players, message.canStart, message.inGame);
    else if (message.t === 'snapshot') this.handlers.onSnapshot(message.state, message.names);
    else if (message.t === 'error') this.handlers.onError(message.message);
  }
}
