import { FixedLoop } from '../core/loop';
import type { GameState } from '../game/state';
import { createGame } from '../game/state';
import { updateGame } from '../game/update';
import { Controls } from '../input/controls';
import type { LobbyPlayer } from '../net/protocol';
import { normalizePlayerName } from '../net/protocol';
import { Renderer } from '../render/renderer';
import { Sfx } from '../audio/sfx';
import { NetworkClient } from './net';

type AppMode = 'menu' | 'solo' | 'lobby' | 'network';

export class App {
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly gameActions: HTMLElement;
  private readonly renderer: Renderer;
  private readonly controls = new Controls();
  private readonly sfx = new Sfx();
  private readonly loop: FixedLoop;
  private mode: AppMode = 'menu';
  private state: GameState | null = null;
  private network: NetworkClient | null = null;
  private localPlayerIndex = 0;
  private names: string[] = ['VIPER 1'];
  private lobbyPlayers: LobbyPlayer[] = [];
  private canStart = false;
  private ready = false;
  private lastAudioTick = -1;
  private endScreenShown = false;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = this.shellMarkup();
    this.canvas = this.required<HTMLCanvasElement>('#game-canvas');
    this.overlay = this.required<HTMLElement>('#overlay');
    this.toast = this.required<HTMLElement>('#toast');
    this.gameActions = this.required<HTMLElement>('#game-actions');
    this.renderer = new Renderer(this.canvas);
    this.loop = new FixedLoop(() => this.update(), () => this.render());
    this.bindActions();
    this.showMenu();
    this.loop.start();

    if (new URLSearchParams(location.search).has('local')) {
      window.setTimeout(() => this.joinLocal(), 200);
    }
  }

  private update(): void {
    const input = this.controls.read();
    if (this.mode === 'solo' && this.state) updateGame(this.state, [input]);
    else if (this.mode === 'network') this.network?.sendInput(input);
    if (this.state && (this.state.phase === 'gameOver' || this.state.phase === 'victory') && !this.endScreenShown) {
      this.endScreenShown = true;
      this.showEndActions();
    }
  }

  private render(): void {
    if (!this.state) return;
    this.renderer.draw(this.state, this.names, this.localPlayerIndex);
    if (this.state.tick !== this.lastAudioTick) {
      this.sfx.playEvents(this.state.events);
      this.lastAudioTick = this.state.tick;
    }
  }

  private startSolo(): void {
    this.sfx.unlock();
    const name = this.callSign();
    this.mode = 'solo';
    this.names = [name];
    this.localPlayerIndex = 0;
    this.state = createGame(1, (Date.now() ^ 0x17a0) >>> 0);
    this.endScreenShown = false;
    this.hideOverlay();
    this.gameActions.classList.remove('visible');
  }

  private joinLocal(): void {
    this.sfx.unlock();
    this.disconnectNetwork();
    const name = this.callSign();
    this.mode = 'lobby';
    this.state = null;
    this.ready = false;
    this.showLobbyConnecting();
    this.network = new NetworkClient({
      onWelcome: (index) => { this.localPlayerIndex = index; },
      onLobby: (players, canStart, inGame) => {
        this.lobbyPlayers = players;
        this.canStart = canStart;
        if (!inGame) this.renderLobby();
      },
      onSnapshot: (state, names) => {
        this.state = state;
        this.names = names;
        if (this.mode !== 'network') {
          this.mode = 'network';
          this.endScreenShown = false;
          this.hideOverlay();
        }
      },
      onError: (message) => this.showToast(message, true),
      onClose: () => {
        if (this.mode === 'network' || this.mode === 'lobby') {
          this.showToast('与本地作战服务器的连接已断开', true);
          window.setTimeout(() => this.showMenu(), 900);
        }
      },
    });
    this.network.connect(name);
  }

  private showMenu(): void {
    this.mode = 'menu';
    this.state = null;
    this.endScreenShown = false;
    this.gameActions.classList.remove('visible');
    this.overlay.className = 'overlay menu-overlay visible';
    const saved = localStorage.getItem('iron-viper-name') || 'ROOKIE';
    this.overlay.innerHTML = `
      <div class="menu-grid" aria-label="Operation Iron Viper main menu">
        <div class="classification"><span>LV-04</span> JOINT OPERATIONS COMMAND</div>
        <div class="title-lockup">
          <p class="eyebrow">OPERATION</p>
          <h1><span>IRON</span><br>VIPER</h1>
          <div class="title-strike"></div>
          <p class="tagline">FOUR SOLDIERS. ONE LAST LINE.</p>
        </div>
        <div class="mission-card">
          <div class="card-index">// DEPLOYMENT TERMINAL</div>
          <label class="field-label" for="callsign">CALL SIGN</label>
          <input id="callsign" class="callsign" maxlength="12" value="${escapeHtml(saved)}" autocomplete="nickname" spellcheck="false">
          <div class="deploy-actions">
            <button class="command primary" data-action="solo"><span>01</span> SOLO MISSION</button>
            <button class="command" data-action="local"><span>02</span> LOCAL CO-OP <em>1–4</em></button>
          </div>
          <p class="local-note">LOCAL CO-OP REQUIRES <strong>npm run lan</strong><br>SHARE THE PRINTED <strong>?local</strong> ADDRESS ON THE SAME WI-FI.</p>
        </div>
        <div class="intel-strip">
          <span>4 SECTORS</span><i></i><span>4 COMMANDERS</span><i></i><span>3 CONTINUES</span><i></i><span>NO EXTRACTION</span>
        </div>
        <div class="controls-brief">
          <div><b>MOVE / AIM</b><span>WASD · ARROWS · STICK</span></div>
          <div><b>FIRE</b><span>J · X · PAD X/B</span></div>
          <div><b>JUMP</b><span>K · Z · SPACE · PAD A</span></div>
          <div><b>RESCUE</b><span>L · E · PAD Y</span></div>
        </div>
      </div>`;
    this.bindOverlayActions();
  }

  private showLobbyConnecting(): void {
    this.overlay.className = 'overlay lobby-overlay visible';
    this.overlay.innerHTML = `
      <div class="lobby-panel">
        <p class="eyebrow">SAME WI-FI / LIVE CHANNEL</p>
        <h2>ASSEMBLING FIRETEAM</h2>
        <div class="signal-loader"><i></i><i></i><i></i><i></i><i></i></div>
        <p class="lobby-status">CONTACTING LOCAL COMMAND...</p>
        <button class="text-button" data-action="exit">ABORT CONNECTION</button>
      </div>`;
    this.bindOverlayActions();
  }

  private renderLobby(): void {
    if (this.mode !== 'lobby') return;
    const me = this.lobbyPlayers.find((player) => player.index === this.localPlayerIndex);
    const slots = Array.from({ length: 4 }, (_, index) => {
      const player = this.lobbyPlayers.find((entry) => entry.index === index);
      if (!player) return `<div class="squad-slot empty"><span>0${index + 1}</span><div><b>OPEN CHANNEL</b><small>WAITING FOR SOLDIER</small></div></div>`;
      return `<div class="squad-slot p${index + 1}"><span>0${index + 1}</span><div><b>${escapeHtml(player.name)}${player.host ? ' ★' : ''}</b><small>${player.ready ? 'LOCKED & LOADED' : 'CHECKING GEAR'}</small></div><i class="ready-lamp ${player.ready ? 'on' : ''}"></i></div>`;
    }).join('');
    const isHost = !!me?.host;
    this.overlay.className = 'overlay lobby-overlay visible';
    this.overlay.innerHTML = `
      <div class="lobby-panel wide">
        <div class="lobby-heading"><div><p class="eyebrow">LOCAL STRIKE CHANNEL</p><h2>FIRETEAM ROSTER</h2></div><div class="ping">LAN<br><strong>READY</strong></div></div>
        <div class="squad-list">${slots}</div>
        <div class="lobby-actions">
          <button class="command ${this.ready ? '' : 'primary'}" data-action="ready">${this.ready ? 'STAND DOWN' : 'READY UP'}</button>
          ${isHost ? `<button class="command launch" data-action="launch" ${this.canStart ? '' : 'disabled'}>BEGIN OPERATION</button>` : '<p class="waiting-host">WAITING FOR SQUAD LEADER</p>'}
        </div>
        <p class="lobby-tip">TIP // HOLD <strong>L / E</strong> BESIDE A DOWNED ALLY TO SAVE THEIR LIFE.</p>
        <button class="text-button" data-action="exit">LEAVE FIRETEAM</button>
      </div>`;
    this.bindOverlayActions();
  }

  private showEndActions(): void {
    const isHost = this.lobbyPlayers.find((player) => player.index === this.localPlayerIndex)?.host;
    this.gameActions.innerHTML = this.mode === 'solo'
      ? `<button class="command primary" data-action="replay">REDEPLOY</button><button class="command" data-action="exit">RETURN TO COMMAND</button>`
      : `${isHost ? '<button class="command primary" data-action="network-replay">REDEPLOY FIRETEAM</button>' : ''}<button class="command" data-action="exit">RETURN TO COMMAND</button>`;
    this.gameActions.classList.add('visible');
    this.gameActions.querySelector('[data-action="replay"]')?.addEventListener('click', () => this.startSolo());
    this.gameActions.querySelector('[data-action="network-replay"]')?.addEventListener('click', () => {
      this.gameActions.classList.remove('visible'); this.endScreenShown = false; this.network?.restart();
    });
    this.gameActions.querySelector('[data-action="exit"]')?.addEventListener('click', () => this.exitToMenu());
  }

  private bindActions(): void {
    this.root.querySelector('[data-action="sound"]')?.addEventListener('click', (event) => {
      this.sfx.unlock();
      const enabled = this.sfx.toggle();
      (event.currentTarget as HTMLElement).textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    });
  }

  private bindOverlayActions(): void {
    this.overlay.querySelector('[data-action="solo"]')?.addEventListener('click', () => this.startSolo());
    this.overlay.querySelector('[data-action="local"]')?.addEventListener('click', () => this.joinLocal());
    this.overlay.querySelector('[data-action="ready"]')?.addEventListener('click', () => {
      this.ready = !this.ready; this.network?.setReady(this.ready); this.renderLobby();
    });
    this.overlay.querySelector('[data-action="launch"]')?.addEventListener('click', () => this.network?.start());
    this.overlay.querySelector('[data-action="exit"]')?.addEventListener('click', () => this.exitToMenu());
  }

  private exitToMenu(): void {
    this.disconnectNetwork();
    this.showMenu();
  }

  private disconnectNetwork(): void {
    const network = this.network;
    this.network = null;
    network?.close();
  }

  private callSign(): string {
    const field = this.overlay.querySelector<HTMLInputElement>('#callsign');
    const name = normalizePlayerName(field?.value ?? localStorage.getItem('iron-viper-name'));
    localStorage.setItem('iron-viper-name', name);
    return name;
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('visible');
    window.setTimeout(() => { if (!this.overlay.classList.contains('visible')) this.overlay.innerHTML = ''; }, 400);
  }

  private showToast(message: string, danger = false): void {
    this.toast.textContent = message;
    this.toast.className = `toast visible${danger ? ' danger' : ''}`;
    window.setTimeout(() => this.toast.classList.remove('visible'), 3200);
  }

  private required<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  }

  private shellMarkup(): string {
    return `
      <main class="command-room">
        <div class="atmosphere"></div>
        <header class="top-rail">
          <div class="brand-mark"><i></i><span>JV-84</span></div>
          <p>JOINT VECTOR COMMAND // TERMINAL 07</p>
          <button class="rail-button" data-action="sound">SOUND ON</button>
        </header>
        <section class="cabinet" aria-label="Operation Iron Viper game display">
          <div class="cabinet-label"><span>FIELD DISPLAY</span><b>CRT-384</b></div>
          <div class="screen-bezel">
            <canvas id="game-canvas"></canvas>
            <div id="overlay" class="overlay visible"></div>
            <div id="game-actions" class="game-actions"></div>
            <div class="glass-noise"></div>
          </div>
          <div class="cabinet-footer"><span>▲ SYNC LINK ENABLED</span><span>AUTHORIZED PERSONNEL ONLY</span><span>60 HZ // LAN</span></div>
        </section>
        <div id="toast" class="toast" role="status"></div>
        <div class="desktop-only">DESKTOP TERMINAL REQUIRED</div>
      </main>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}
