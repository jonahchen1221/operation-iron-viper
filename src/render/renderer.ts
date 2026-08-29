import {
  LINK_ACTIVE_TICKS,
  LINK_CHARGE_TICKS,
  PLAYER_COLORS,
  REVIVE_TICKS,
  TICK_RATE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../core/constants';
import type { Rect, ThemeKind } from '../core/types';
import { getLevel, type LevelDef, type TerrainRect } from '../game/levels';
import type { BulletState, EnemyState, GameState, PickupState, PlayerState } from '../game/state';

interface Palette {
  sky: string;
  sky2: string;
  far: string;
  mid: string;
  ground: string;
  groundLight: string;
  groundDark: string;
  accent: string;
}

const PALETTES: Record<ThemeKind, Palette> = {
  jungle: {
    sky: '#020816', sky2: '#082451', far: '#0b3c2a', mid: '#28732c',
    ground: '#926b22', groundLight: '#8ed329', groundDark: '#30200d', accent: '#b5f13a',
  },
  base: {
    sky: '#030711', sky2: '#101b32', far: '#1a263d', mid: '#405476',
    ground: '#516174', groundLight: '#aab6bd', groundDark: '#1b2230', accent: '#63dbff',
  },
  waterfall: {
    sky: '#031328', sky2: '#074b78', far: '#176379', mid: '#2996a1',
    ground: '#5a5b4d', groundLight: '#b8cb8a', groundDark: '#232b2b', accent: '#7df4ff',
  },
  fortress: {
    sky: '#100107', sky2: '#3a0712', far: '#64151b', mid: '#963022',
    ground: '#5d4742', groundLight: '#d2874f', groundDark: '#211317', accent: '#ff663d',
  },
};

interface SpriteRegion { sx: number; sy: number; sw: number; sh: number }

const PLAYER_SPRITES = {
  idle: { sx: 0, sy: 32, sw: 225, sh: 308 },
  run1: { sx: 220, sy: 26, sw: 290, sh: 316 },
  run2: { sx: 495, sy: 24, sw: 300, sh: 322 },
  crouch: { sx: 780, sy: 110, sw: 270, sh: 240 },
  jump: { sx: 1030, sy: 0, sw: 190, sh: 312 },
  curl: { sx: 1190, sy: 60, sw: 205, sh: 282 },
  ball: { sx: 1370, sy: 130, sw: 166, sh: 220 },
  aimUp: { sx: 0, sy: 350, sw: 245, sh: 365 },
  aimDiag: { sx: 245, sy: 350, sw: 290, sh: 365 },
  fire: { sx: 530, sy: 365, sw: 365, sh: 350 },
  hurt: { sx: 890, sy: 365, sw: 330, sh: 350 },
} satisfies Record<string, SpriteRegion>;

const ENEMY_SPRITES = {
  idle: { sx: 0, sy: 715, sw: 220, sh: 309 },
  run1: { sx: 215, sy: 700, sw: 290, sh: 324 },
  run2: { sx: 485, sy: 700, sw: 295, sh: 324 },
  aim: { sx: 750, sy: 700, sw: 225, sh: 324 },
  fire: { sx: 945, sy: 690, sw: 310, sh: 334 },
} satisfies Record<string, SpriteRegion>;

const BOSS_SPRITES = {
  wallCannon: { sx: 0, sy: 0, sw: 768, sh: 512 },
  reactor: { sx: 768, sy: 0, sw: 768, sh: 512 },
  skySerpent: { sx: 0, sy: 512, sw: 768, sh: 512 },
  ironViper: { sx: 768, sy: 512, sw: 768, sh: 512 },
} satisfies Record<string, SpriteRegion>;

const COMBAT_SPRITES = {
  capsule: { sx: 0, sy: 110, sw: 384, sh: 280 },
  turret: { sx: 384, sy: 90, sw: 384, sh: 350 },
  drone: { sx: 768, sy: 100, sw: 384, sh: 330 },
  orb: { sx: 1152, sy: 80, sw: 384, sh: 370 },
  spark: { sx: 0, sy: 560, sw: 384, sh: 400 },
  blastSmall: { sx: 384, sy: 550, sw: 384, sh: 420 },
  blastMedium: { sx: 768, sy: 550, sw: 384, sh: 420 },
  blastLarge: { sx: 1152, sy: 540, sw: 384, sh: 440 },
} satisfies Record<string, SpriteRegion>;

function playerVariantRegion(index: number, pose: 'idle' | 'run' | 'prone'): SpriteRegion {
  const cellX = clamp(index, 0, 3) * 384;
  if (pose === 'idle') return { sx: cellX + 38, sy: 25, sw: 308, sh: 315 };
  if (pose === 'run') return { sx: cellX + 28, sy: 350, sw: 328, sh: 340 };
  return { sx: cellX + 8, sy: 710, sw: 368, sh: 255 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pixel(value: number): number {
  return Math.round(value);
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly jungleBackdrop = new Image();
  private readonly baseBackdrop = new Image();
  private readonly waterfallBackdrop = new Image();
  private readonly fortressBackdrop = new Image();
  private readonly jungleTerrainTile = new Image();
  private readonly baseTerrainTile = new Image();
  private readonly waterfallTerrainTile = new Image();
  private readonly fortressTerrainTile = new Image();
  private readonly spriteAtlas = new Image();
  private readonly bossAtlas = new Image();
  private readonly combatAtlas = new Image();
  private readonly playerVariantAtlas = new Image();
  private cameraX = 0;
  private cameraY = 0;
  private cameraStage = -1;
  private shake = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = VIEW_WIDTH * 2;
    canvas.height = VIEW_HEIGHT * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.jungleBackdrop.src = '/assets/generated/jungle-backdrop.png';
    this.baseBackdrop.src = '/assets/generated/base-backdrop.png';
    this.waterfallBackdrop.src = '/assets/generated/waterfall-backdrop.png';
    this.fortressBackdrop.src = '/assets/generated/fortress-backdrop.png';
    this.jungleTerrainTile.src = '/assets/generated/jungle-terrain-tile.png';
    this.baseTerrainTile.src = '/assets/generated/base-terrain-tile.png';
    this.waterfallTerrainTile.src = '/assets/generated/waterfall-terrain-tile.png';
    this.fortressTerrainTile.src = '/assets/generated/fortress-terrain-tile.png';
    this.spriteAtlas.src = '/assets/generated/commando-atlas.png';
    this.bossAtlas.src = '/assets/generated/boss-atlas-v2.png';
    this.combatAtlas.src = '/assets/generated/combat-atlas-v2.png';
    this.playerVariantAtlas.src = '/assets/generated/player-variants-v2.png';
  }

  draw(state: GameState, names: readonly string[], localPlayerIndex: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(2, 2);
    ctx.imageSmoothingEnabled = false;
    const level = getLevel(state.stageIndex);
    this.updateCamera(state, level, localPlayerIndex);
    if (state.events.some((event) => event === 'bossDown' || event === 'playerDown')) this.shake = 7;
    const shakeX = this.shake > 0 ? ((state.tick * 7) % 3) - 1 : 0;
    const shakeY = this.shake > 0 ? ((state.tick * 11) % 3) - 1 : 0;
    if (this.shake > 0) this.shake--;
    ctx.translate(shakeX, shakeY);

    this.drawBackground(level, state.tick);
    ctx.save();
    ctx.translate(-pixel(this.cameraX), -pixel(this.cameraY));
    this.drawWorld(state, level);
    ctx.restore();
    this.drawHud(state, names, level);
    this.drawOffscreenMarkers(state, localPlayerIndex);
    this.drawPhaseOverlay(state, level);
    this.drawCrtMask();
    ctx.restore();
  }

  private updateCamera(state: GameState, level: LevelDef, localPlayerIndex: number): void {
    const player = state.players[localPlayerIndex] ?? state.players.find((entry) => entry.status === 'active');
    const fallbackX = state.checkpointX;
    const fallbackY = state.checkpointY;
    const targetX = player?.x ?? fallbackX;
    const targetY = player?.y ?? fallbackY;
    const desiredX = level.axis === 'horizontal'
      ? clamp(targetX - VIEW_WIDTH * 0.35, 0, Math.max(0, level.width - VIEW_WIDTH))
      : 0;
    const desiredY = level.axis === 'vertical'
      ? clamp(targetY - VIEW_HEIGHT * 0.58, 0, Math.max(0, level.height - VIEW_HEIGHT))
      : 0;
    if (this.cameraStage !== state.stageIndex) {
      this.cameraStage = state.stageIndex;
      this.cameraX = desiredX;
      this.cameraY = desiredY;
    } else {
      this.cameraX += (desiredX - this.cameraX) * 0.12;
      this.cameraY += (desiredY - this.cameraY) * 0.12;
    }
  }

  private drawBackground(level: LevelDef, tick: number): void {
    const ctx = this.ctx;
    const palette = PALETTES[level.theme];
    ctx.fillStyle = palette.sky;
    ctx.fillRect(-2, -2, VIEW_WIDTH + 4, VIEW_HEIGHT + 4);
    ctx.fillStyle = palette.sky2;
    ctx.fillRect(0, 54, VIEW_WIDTH, VIEW_HEIGHT - 54);

    if (level.theme === 'jungle') this.drawJungleBackground(palette);
    else if (level.theme === 'base') this.drawBaseBackground(palette, tick);
    else if (level.theme === 'waterfall') this.drawWaterfallBackground(palette, tick);
    else this.drawFortressBackground(palette, tick);
    this.drawAmbientEffects(level.theme, tick);
  }

  private drawJungleBackground(p: Palette): void {
    const ctx = this.ctx;
    if (this.drawBackdropAsset(this.jungleBackdrop, 0, this.cameraX * 0.075)) {
      ctx.fillStyle = 'rgba(0,8,12,.12)';
      ctx.fillRect(0, 0, VIEW_WIDTH, 18);
      return;
    }
    const offset = -Math.floor(this.cameraX * 0.2) % 64;
    ctx.fillStyle = p.far;
    for (let x = offset - 64; x < VIEW_WIDTH + 64; x += 64) {
      ctx.fillRect(x + 24, 62, 10, 122);
      ctx.fillRect(x + 10, 58, 38, 8);
      ctx.fillRect(x + 4, 48, 50, 7);
      ctx.fillStyle = p.mid;
      ctx.fillRect(x + 15, 42, 17, 8);
      ctx.fillRect(x + 34, 50, 22, 8);
      ctx.fillStyle = p.far;
    }
  }

  private drawBaseBackground(p: Palette, tick: number): void {
    const ctx = this.ctx;
    if (this.drawBackdropAsset(this.baseBackdrop, 100, this.cameraX * 0.08)) return;
    const offset = -Math.floor(this.cameraX * 0.18) % 64;
    ctx.fillStyle = p.far;
    for (let x = offset - 64; x < VIEW_WIDTH + 64; x += 64) {
      ctx.fillRect(x, 36, 44, 140);
      ctx.fillStyle = p.mid;
      ctx.fillRect(x + 6, 48, 32, 4);
      ctx.fillRect(x + 6, 62, 20, 3);
      ctx.fillStyle = p.far;
    }
    ctx.strokeStyle = '#314b52';
    ctx.lineWidth = 2;
    for (let y = 28; y < 180; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_WIDTH, y);
      ctx.stroke();
    }
    ctx.fillStyle = tick % 50 < 25 ? '#ff5b45' : '#59221d';
    for (let x = 22; x < VIEW_WIDTH; x += 88) ctx.fillRect(x, 28, 3, 3);
  }

  private drawWaterfallBackground(p: Palette, tick: number): void {
    const ctx = this.ctx;
    if (this.drawBackdropAsset(this.waterfallBackdrop, 35, this.cameraY * 0.025)) return;
    ctx.fillStyle = p.far;
    for (let x = 0; x < VIEW_WIDTH; x += 96) ctx.fillRect(x + 16, 0, 48, VIEW_HEIGHT);
    ctx.fillStyle = '#2b8195';
    for (let x = -20; x < VIEW_WIDTH + 30; x += 48) {
      const slide = (tick * (1 + ((x / 48) & 1))) % 24;
      for (let y = -24 + slide; y < VIEW_HEIGHT; y += 24) {
        ctx.fillRect(x, y, 2, 13);
        ctx.fillRect(x + 3, y + 5, 1, 9);
      }
    }
    ctx.fillStyle = '#72e4ee';
    for (let x = 36; x < VIEW_WIDTH; x += 96) ctx.fillRect(x, 0, 2, VIEW_HEIGHT);
  }

  private drawFortressBackground(p: Palette, tick: number): void {
    const ctx = this.ctx;
    if (this.drawBackdropAsset(this.fortressBackdrop, 105, this.cameraX * 0.07)) return;
    ctx.fillStyle = '#ca3e21';
    ctx.fillRect(300, 24, 28, 28);
    ctx.fillStyle = '#47100c';
    ctx.fillRect(308, 24, 12, 28);
    ctx.fillStyle = p.far;
    const offset = -Math.floor(this.cameraX * 0.2) % 72;
    for (let x = offset - 72; x < VIEW_WIDTH + 72; x += 72) {
      ctx.fillRect(x, 98, 52, 86);
      ctx.fillRect(x + 9, 78, 34, 20);
      ctx.fillRect(x + 18, 56, 16, 22);
      ctx.fillStyle = tick % 32 < 16 ? '#ff7b34' : '#7a2417';
      ctx.fillRect(x + 24, 66, 4, 4);
      ctx.fillStyle = p.far;
    }
    ctx.fillStyle = p.mid;
    ctx.fillRect(0, 154, VIEW_WIDTH, 30);
  }

  private drawBackdropAsset(image: HTMLImageElement, cropTop: number, pan: number): boolean {
    if (!image.complete || image.naturalWidth === 0) return false;
    const sourceHeight = image.naturalHeight - cropTop;
    const sourceWidth = Math.min(image.naturalWidth, Math.round(sourceHeight * 16 / 9));
    const maxPan = Math.max(0, image.naturalWidth - sourceWidth);
    const sourceX = maxPan === 0 ? 0 : Math.floor(Math.abs(pan) % maxPan);
    this.ctx.save();
    this.ctx.filter = 'brightness(1.12) saturate(1.14) contrast(1.04)';
    this.ctx.drawImage(image, sourceX, cropTop, sourceWidth, sourceHeight, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.ctx.restore();
    return true;
  }

  private drawAmbientEffects(theme: ThemeKind, tick: number): void {
    const ctx = this.ctx;
    ctx.save();
    if (theme === 'jungle') {
      ctx.globalAlpha = .65;
      ctx.fillStyle = '#78c52d';
      for (let index = 0; index < 9; index++) {
        const x = (index * 47 + tick * .32) % (VIEW_WIDTH + 20) - 10;
        const y = 35 + ((index * 29 + tick * .18) % 118);
        ctx.fillRect(pixel(x), pixel(y), index % 3 === 0 ? 3 : 2, 1);
      }
    } else if (theme === 'base') {
      if (tick % 48 < 24) {
        ctx.globalAlpha = .8;
        for (const x of [30, 128, 226, 324]) {
          this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.orb, x - 3, 53, 7, 7);
        }
      }
    } else if (theme === 'waterfall') {
      ctx.globalAlpha = .42;
      ctx.fillStyle = '#b8ffff';
      for (let index = 0; index < 20; index++) {
        const x = (index * 31 + (index % 4) * 7) % VIEW_WIDTH;
        const y = (index * 43 + tick * (1 + index % 3)) % VIEW_HEIGHT;
        ctx.fillRect(x, y, index % 4 === 0 ? 2 : 1, 7 + index % 6);
      }
    } else {
      const glow = tick % 36 < 18 ? 8 : 5;
      ctx.globalAlpha = .62;
      for (const x of [58, 156, 254, 352]) {
        this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.orb, x - glow / 2, 92 - glow / 2, glow, glow);
      }
    }
    ctx.restore();
  }

  private drawWorld(state: GameState, level: LevelDef): void {
    this.drawCheckpoints(state, level);
    this.drawTerrain(level, state.tick);
    this.drawHazards(level, state.tick);
    this.drawPickups(state.pickups, state.tick);
    this.drawLink(state);
    for (const enemy of state.enemies) this.drawEnemy(enemy, state.tick);
    for (const player of state.players) this.drawPlayer(player, state.tick);
    for (const bullet of state.bullets) this.drawBullet(bullet, state.tick);
    for (const explosion of state.explosions) this.drawExplosion(explosion.x, explosion.y, explosion.ticks, explosion.size);
  }

  private drawTerrain(level: LevelDef, tick: number): void {
    const ctx = this.ctx;
    const palette = PALETTES[level.theme];
    for (const terrain of level.terrain) {
      const visualHeight = terrain.kind === 'bridge' || terrain.h <= 10 ? Math.max(14, terrain.h) : terrain.h;
      const terrainTile = level.theme === 'jungle' ? this.jungleTerrainTile
        : level.theme === 'base' ? this.baseTerrainTile
          : level.theme === 'waterfall' ? this.waterfallTerrainTile
            : this.fortressTerrainTile;
      if (terrainTile.complete && terrainTile.naturalWidth > 0) {
        ctx.fillStyle = palette.groundDark;
        ctx.fillRect(terrain.x, terrain.y, terrain.w, visualHeight);
        ctx.save();
        ctx.beginPath();
        ctx.rect(terrain.x, terrain.y, terrain.w, visualHeight);
        ctx.clip();
        let tileIndex = 0;
        for (let x = terrain.x; x < terrain.x + terrain.w; x += terrainTile.naturalWidth, tileIndex++) {
          if ((tileIndex & 1) === 0) ctx.drawImage(terrainTile, x, terrain.y);
          else {
            ctx.save();
            ctx.translate(x + terrainTile.naturalWidth, terrain.y);
            ctx.scale(-1, 1);
            ctx.drawImage(terrainTile, 0, 0);
            ctx.restore();
          }
        }
        ctx.restore();
        continue;
      }
      ctx.fillStyle = palette.groundDark;
      ctx.fillRect(terrain.x, terrain.y, terrain.w, visualHeight);
      ctx.fillStyle = terrain.kind === 'bridge' ? '#9e6322' : palette.ground;
      ctx.fillRect(terrain.x, terrain.y, terrain.w, Math.min(visualHeight, level.theme === 'jungle' ? 10 : 7));
      ctx.fillStyle = palette.groundLight;
      ctx.fillRect(terrain.x, terrain.y, terrain.w, level.theme === 'jungle' ? 3 : 2);
      this.drawTerrainTexture(terrain, level.theme, tick);
    }
  }

  private drawTerrainTexture(terrain: TerrainRect, theme: ThemeKind, tick: number): void {
    const ctx = this.ctx;
    if (theme === 'jungle') {
      ctx.fillStyle = '#417d1f';
      for (let x = terrain.x + 2; x < terrain.x + terrain.w; x += 8) {
        ctx.fillRect(x, terrain.y + 3 + ((x >> 3) & 1), 5, 3);
        ctx.fillRect(x + 2, terrain.y - 2 - ((x >> 4) & 1), 2, 4);
      }
      ctx.fillStyle = '#c29335';
      for (let x = terrain.x + 4; x < terrain.x + terrain.w; x += 13) ctx.fillRect(x, terrain.y + 11, 6, 3);
      ctx.fillStyle = '#4c3216';
      for (let x = terrain.x + 8; x < terrain.x + terrain.w; x += 17) ctx.fillRect(x, terrain.y + 16, 7, 4);
    } else if (theme === 'base' || theme === 'fortress') {
      ctx.fillStyle = theme === 'base' ? '#1b2a2e' : '#2a2320';
      for (let x = terrain.x + 8; x < terrain.x + terrain.w; x += 16) {
        ctx.fillRect(x, terrain.y + 8, 1, Math.max(0, terrain.h - 10));
        ctx.fillRect(x + 3, terrain.y + 10, 3, 2);
      }
    } else {
      ctx.fillStyle = '#243e42';
      for (let x = terrain.x + 4; x < terrain.x + terrain.w; x += 11) ctx.fillRect(x, terrain.y + 7, 6, 2);
      ctx.fillStyle = tick % 20 < 10 ? '#71d0d2' : '#4b9298';
      ctx.fillRect(terrain.x + 2, terrain.y + 2, Math.max(0, terrain.w - 4), 1);
    }
  }

  private drawHazards(level: LevelDef, tick: number): void {
    const ctx = this.ctx;
    for (const hazard of level.hazards) {
      if (hazard.kind === 'water') {
        ctx.fillStyle = '#0c5068';
        ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
        ctx.fillStyle = '#62d5de';
        for (let x = hazard.x + ((tick >> 2) % 8); x < hazard.x + hazard.w; x += 12) ctx.fillRect(x, hazard.y, 7, 2);
      } else if (hazard.kind === 'spikes') {
        ctx.fillStyle = '#d2d1bc';
        for (let x = hazard.x; x < hazard.x + hazard.w; x += 8) {
          ctx.beginPath();
          ctx.moveTo(x, hazard.y + hazard.h);
          ctx.lineTo(x + 4, hazard.y);
          ctx.lineTo(x + 8, hazard.y + hazard.h);
          ctx.fill();
        }
      } else {
        const active = (tick + Math.floor(hazard.x)) % 120 < 70;
        ctx.fillStyle = active ? '#ff453d' : '#421c22';
        ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
        if (active) {
          ctx.fillStyle = '#ffd86a';
          ctx.fillRect(hazard.x, hazard.y + 2, hazard.w, 1);
        } else {
          ctx.fillStyle = '#8a3230';
          for (let x = hazard.x; x < hazard.x + hazard.w; x += 12) ctx.fillRect(x, hazard.y + 2, 4, 1);
        }
      }
    }
  }

  private drawCheckpoints(state: GameState, level: LevelDef): void {
    const ctx = this.ctx;
    for (let index = 0; index < level.checkpoints.length; index++) {
      const checkpoint = level.checkpoints[index];
      if (!checkpoint) continue;
      const active = index <= state.checkpointIndex;
      ctx.fillStyle = active ? '#d8ff56' : '#58665a';
      ctx.fillRect(checkpoint.x, checkpoint.y - 18, 2, 18);
      ctx.beginPath();
      ctx.moveTo(checkpoint.x + 2, checkpoint.y - 17);
      ctx.lineTo(checkpoint.x + 13, checkpoint.y - 12);
      ctx.lineTo(checkpoint.x + 2, checkpoint.y - 8);
      ctx.fill();
    }
  }

  private drawAtlasSprite(region: SpriteRegion, x: number, y: number, w: number, h: number, flip: boolean): boolean {
    return this.drawImageSprite(this.spriteAtlas, region, x, y, w, h, flip);
  }

  private drawImageSprite(
    image: HTMLImageElement,
    region: SpriteRegion,
    x: number,
    y: number,
    w: number,
    h: number,
    flip = false,
  ): boolean {
    if (!image.complete || image.naturalWidth === 0) return false;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(pixel(x + (flip ? w : 0)), pixel(y));
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(image, region.sx, region.sy, region.sw, region.sh, 0, 0, pixel(w), pixel(h));
    ctx.restore();
    return true;
  }

  private drawPlayer(player: PlayerState, tick: number): void {
    if (player.status === 'eliminated' || player.status === 'respawning') return;
    const ctx = this.ctx;
    const color = PLAYER_COLORS[player.index] ?? '#fff';
    const flash = player.invulnTicks > 0 && tick % 6 < 3;
    if (flash) ctx.globalAlpha = 0.3;
    const x = pixel(player.x);
    const y = pixel(player.y);
    const flip = player.facing < 0;

    if (player.status === 'downed') {
      this.drawAtlasSprite(PLAYER_SPRITES.hurt, x - 8, y - 5, 34, 30, flip);
      ctx.fillStyle = '#150608'; ctx.fillRect(x - 5, y - 9, 23, 5);
      ctx.fillStyle = '#ff4438'; ctx.fillRect(x - 4, y - 8, 21, 3);
      ctx.fillStyle = '#dfff4c'; ctx.fillRect(x - 4, y - 8, 21 * (player.reviveProgress / REVIVE_TICKS), 3);
      ctx.globalAlpha = 1;
      return;
    }

    let sprite: SpriteRegion = PLAYER_SPRITES.idle;
    let width = 34;
    let height = 42;
    let drawX = x - 11;
    let drawY = y - 18;
    let variantPose: 'idle' | 'run' | 'prone' | null = 'idle';
    let muzzleFlash = false;
    if (!player.onGround) {
      variantPose = null;
      const frame = (player.animationTick >> 2) % 3;
      sprite = frame === 0 ? PLAYER_SPRITES.jump : frame === 1 ? PLAYER_SPRITES.curl : PLAYER_SPRITES.ball;
      width = frame === 2 ? 24 : 27;
      height = frame === 2 ? 27 : 31;
      drawX = x - 7;
      drawY = y - 4;
    } else if (player.crouching) {
      variantPose = 'prone';
      width = 46; height = 20; drawX = flip ? x - 33 : x - 2; drawY = y + 5;
      muzzleFlash = player.fireCooldown > 8;
    } else if (player.aim === 'up') {
      variantPose = null;
      sprite = PLAYER_SPRITES.aimUp;
      width = 27; height = 43; drawX = x - 7; drawY = y - 19;
    } else if (player.aim === 'diagUp') {
      variantPose = null;
      sprite = PLAYER_SPRITES.aimDiag;
      width = 31; height = 40; drawX = x - 8; drawY = y - 16;
    } else if (player.fireCooldown > 14) {
      variantPose = 'idle';
      muzzleFlash = true;
    } else if (Math.abs(player.vx) > 0.2) {
      variantPose = ((player.animationTick >> 3) & 1) === 0 ? 'run' : 'idle';
      width = variantPose === 'run' ? 35 : 34; height = 42; drawX = x - 11; drawY = y - 18;
    }

    const drawn = variantPose
      ? this.drawImageSprite(this.playerVariantAtlas, playerVariantRegion(player.index, variantPose), drawX, drawY, width, height, flip)
      : this.drawAtlasSprite(sprite, drawX, drawY, width, height, flip);
    if (!drawn) {
      ctx.fillStyle = color; ctx.fillRect(x, y, 12, 24);
    }
    if (muzzleFlash) {
      const flashX = player.crouching ? (flip ? x - 26 : x + 38) : (flip ? x - 15 : x + 26);
      const flashY = player.crouching ? y + 10 : y + 8;
      this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.spark, flashX - 4, flashY - 4, 9, 9);
    }

    if (player.barrierHits > 0) {
      for (let index = 0; index < 4; index++) {
        const angle = tick / 9 + index * Math.PI / 2;
        const sx = x + 6 + Math.cos(angle) * 14;
        const sy = y + 11 + Math.sin(angle) * 17;
        ctx.save(); ctx.filter = 'hue-rotate(150deg) saturate(1.8)';
        this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.spark, sx - 3, sy - 3, 7, 7);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemy(enemy: EnemyState, tick: number): void {
    const ctx = this.ctx;
    const x = pixel(enemy.x);
    const y = pixel(enemy.y);
    if (enemy.hitFlashTicks > 0) ctx.globalAlpha = tick % 2 ? 0.35 : 1;
    if (enemy.kind === 'boss') {
      this.drawBoss(enemy, tick);
      ctx.globalAlpha = 1;
      return;
    }
    if (enemy.kind === 'flyer') {
      const bob = Math.sin((tick + enemy.id * 9) / 8) * 2;
      if (!this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.drone, x - 4, y - 5 + bob, 26, 20, enemy.facing < 0)) {
        ctx.fillStyle = '#929ea1'; ctx.fillRect(x, y, 18, 10);
      }
    } else if (enemy.kind === 'turret') {
      if (!this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.turret, x - 5, y - 7, 28, 25, enemy.facing < 0)) {
        ctx.fillStyle = '#687884'; ctx.fillRect(x - 2, y, 20, 18);
      }
    } else {
      const walking = Math.abs(enemy.vx) > 0.15;
      const frame = walking
        ? (((tick + Math.floor(enemy.x)) >> 3) & 1 ? ENEMY_SPRITES.run1 : ENEMY_SPRITES.run2)
        : enemy.kind === 'sniper' ? ENEMY_SPRITES.aim : ENEMY_SPRITES.idle;
      ctx.save();
      if (enemy.kind === 'runner') ctx.filter = 'brightness(1.35) sepia(.7) saturate(2) hue-rotate(325deg)';
      else if (enemy.kind === 'sniper') ctx.filter = 'brightness(1.3) sepia(.35) saturate(1.6) hue-rotate(205deg)';
      else ctx.filter = 'brightness(1.35) contrast(1.12) saturate(1.15)';
      const drawn = this.drawAtlasSprite(frame, x - 8, y - 12, 29, 36, enemy.facing < 0);
      ctx.restore();
      if (!drawn) {
        ctx.fillStyle = '#738271'; ctx.fillRect(x, y, enemy.width, enemy.height);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBoss(boss: EnemyState, tick: number): void {
    const ctx = this.ctx;
    const x = pixel(boss.x);
    const y = pixel(boss.y);
    const pulse = tick % 20 < 10 ? '#ff5b3b' : '#ffd65a';
    if (boss.bossKind) {
      const region = BOSS_SPRITES[boss.bossKind];
      const layout = boss.bossKind === 'wallCannon'
        ? { x: x - 38, y: y - 18, w: 112, h: 82 }
        : boss.bossKind === 'reactor'
          ? { x: x - 22, y: y - 20, w: 92, h: 82 }
          : boss.bossKind === 'skySerpent'
            ? { x: x - 31, y: y - 15, w: 120, h: 55 }
            : { x: x - 24, y: y - 29, w: 84, h: 82 };
      const flip = boss.bossKind === 'wallCannon' ? boss.facing < 0 : boss.facing > 0;
      if (this.drawImageSprite(this.bossAtlas, region, layout.x, layout.y, layout.w, layout.h, flip)) return;
    }
    if (boss.bossKind === 'wallCannon') {
      ctx.fillStyle = '#293334'; ctx.fillRect(x, y, boss.width, boss.height);
      ctx.fillStyle = '#718077'; ctx.fillRect(x + 5, y + 5, 31, 48);
      ctx.fillStyle = '#151b1b'; ctx.fillRect(x + 10, y + 15, 23, 22);
      ctx.fillStyle = pulse; ctx.fillRect(x + 17, y + 21, 10, 10);
      ctx.fillStyle = '#a6b09d'; ctx.fillRect(x - 12, y + 24, 25, 6);
    } else if (boss.bossKind === 'reactor') {
      ctx.fillStyle = '#303b41'; ctx.fillRect(x + 4, y, 40, 62);
      ctx.fillStyle = '#829497'; ctx.fillRect(x, y + 11, 48, 42);
      ctx.fillStyle = '#172327'; ctx.fillRect(x + 10, y + 17, 28, 30);
      ctx.fillStyle = pulse; ctx.fillRect(x + 16, y + 23, 16, 18);
      ctx.fillStyle = '#d1d8c8'; ctx.fillRect(x - 9, y + 29, 17, 5);
    } else if (boss.bossKind === 'skySerpent') {
      ctx.fillStyle = '#a8bab3'; ctx.fillRect(x + 7, y + 4, 44, 18);
      ctx.fillStyle = '#304d52'; ctx.fillRect(x, y + 8, 12, 12); ctx.fillRect(x + 46, y + 7, 12, 14);
      ctx.fillStyle = '#e2d45d'; ctx.fillRect(x + 35, y + 2, 12, 7);
      ctx.fillStyle = pulse; ctx.fillRect(x + 42, y + 5, 4, 4);
      ctx.fillStyle = '#6ee5ee';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 12 + i * 11, y + 22, 5, 4 + ((tick + i) % 3));
    } else {
      ctx.fillStyle = '#14191a'; ctx.fillRect(x + 2, y + 39, 10, 11); ctx.fillRect(x + 22, y + 39, 10, 11);
      ctx.fillStyle = '#67726d'; ctx.fillRect(x + 3, y + 17, 28, 25);
      ctx.fillStyle = '#b8c0ab'; ctx.fillRect(x + 8, y + 9, 18, 14);
      ctx.fillStyle = '#2a3031'; ctx.fillRect(x + 11, y + 2, 14, 11);
      ctx.fillStyle = pulse; ctx.fillRect(x + (boss.facing > 0 ? 21 : 11), y + 6, 4, 3);
      ctx.fillStyle = '#c8d4c0'; ctx.fillRect(x + (boss.facing > 0 ? 25 : -15), y + 19, 24, 4);
    }
  }

  private drawBullet(bullet: BulletState, tick: number): void {
    const ctx = this.ctx;
    const x = pixel(bullet.x);
    const y = pixel(bullet.y);
    if (bullet.fromEnemy) {
      const size = bullet.kind === 'plasma' ? 9 : 7;
      if (this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.orb, x - size / 2, y - size / 2, size, size)) return;
      ctx.fillStyle = '#ff4938'; ctx.fillRect(x, y, size, size);
      return;
    }
    if (bullet.kind === 'laser') ctx.fillStyle = '#67f4ff';
    else if (bullet.kind === 'spread') ctx.fillStyle = '#ff8272';
    else ctx.fillStyle = '#f5f2d8';
    const size = bullet.kind === 'plasma' ? 5 : bullet.kind === 'laser' ? 4 : 3;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = bullet.kind === 'spread' ? '#ff3f32' : '#ffe76a';
    ctx.fillRect(pixel(bullet.x - bullet.vx * .7), pixel(bullet.y - bullet.vy * .7), 2, 2);
    if (bullet.kind === 'laser') {
      ctx.fillStyle = tick % 4 < 2 ? '#efffff' : '#248da8';
      ctx.fillRect(pixel(bullet.x - bullet.vx), pixel(bullet.y - bullet.vy), 4, 2);
    }
  }

  private drawPickups(pickups: PickupState[], tick: number): void {
    const ctx = this.ctx;
    for (const pickup of pickups) {
      if (pickup.age > 720 && tick % 8 < 4) continue;
      const x = pixel(pickup.x);
      const y = pixel(pickup.y);
      const bob = Math.sin((tick + pickup.id * 7) / 8) * 2;
      this.drawImageSprite(this.combatAtlas, COMBAT_SPRITES.capsule, x - 7, y - 3 + bob, 28, 17);
      ctx.fillStyle = pickup.kind === 'barrier' ? '#5eeaff' : pickup.kind === 'life' ? '#d8ff56' : '#ff6551';
      ctx.fillRect(x + 3, y + 2 + bob, 7, 8);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      const label = pickup.kind === 'barrier' ? 'B' : pickup.kind === 'life' ? '+' : pickup.kind[0]?.toUpperCase() ?? '?';
      ctx.fillText(label, x + 6.5, y + 3 + bob);
    }
  }

  private drawExplosion(x: number, y: number, ticks: number, size: 'small' | 'large'): void {
    const ctx = this.ctx;
    const phase = size === 'large' ? Math.floor((54 - ticks) / 6) : Math.floor((20 - ticks) / 4);
    const radius = size === 'large' ? 8 + phase * 4 : 3 + phase * 2;
    const region = size === 'large'
      ? (phase < 3 ? COMBAT_SPRITES.blastMedium : COMBAT_SPRITES.blastLarge)
      : (phase < 2 ? COMBAT_SPRITES.spark : COMBAT_SPRITES.blastSmall);
    const artSize = size === 'large' ? 30 + phase * 3 : 12 + phase * 2;
    if (this.drawImageSprite(this.combatAtlas, region, x - artSize / 2, y - artSize / 2, artSize, artSize)) return;
    ctx.fillStyle = '#fff5a4'; ctx.fillRect(pixel(x - radius / 2), pixel(y - radius / 2), radius, radius);
    ctx.fillStyle = '#ff9d32'; ctx.fillRect(pixel(x - radius), pixel(y - 2), radius * 2, 4);
    ctx.fillRect(pixel(x - 2), pixel(y - radius), 4, radius * 2);
    ctx.fillStyle = '#e53e27'; ctx.fillRect(pixel(x - radius / 3), pixel(y - radius / 3), radius * 0.7, radius * 0.7);
  }

  private drawLink(state: GameState): void {
    const active = state.players.filter((player) => player.status === 'active');
    if (active.length < 2 || (state.linkCharge <= 0 && state.linkActiveTicks <= 0)) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = state.linkActiveTicks > 0 ? '#e9ff62' : '#44d5d8';
    ctx.globalAlpha = state.linkActiveTicks > 0 ? 0.75 : 0.35 + 0.35 * (state.linkCharge / LINK_CHARGE_TICKS);
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -state.tick / 3;
    for (let i = 1; i < active.length; i++) {
      const a = active[i - 1];
      const b = active[i];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x + a.width / 2, a.y + a.height / 2);
      ctx.lineTo(b.x + b.width / 2, b.y + b.height / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHud(state: GameState, names: readonly string[], level: LevelDef): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 8, 8, 0.88)';
    ctx.fillRect(0, 0, VIEW_WIDTH, 18);
    ctx.fillStyle = PALETTES[level.theme].accent;
    ctx.fillRect(0, 18, VIEW_WIDTH, 1);
    ctx.font = 'bold 6px monospace';
    ctx.textBaseline = 'top';
    for (let index = 0; index < state.players.length; index++) {
      const player = state.players[index];
      if (!player) continue;
      const x = 5 + index * 68;
      ctx.fillStyle = PLAYER_COLORS[index] ?? '#fff';
      ctx.fillRect(x, 3, 4, 4);
      const name = (names[index] || `VIPER ${index + 1}`).slice(0, 5).toUpperCase();
      ctx.fillText(`P${index + 1} ${name}`, x + 7, 2);
      ctx.fillStyle = '#f0eed8';
      const weapon = player.weapon === 'rifle' ? 'R' : player.weapon === 'machine' ? 'M' : player.weapon === 'spread' ? 'S' : 'L';
      ctx.fillText(`×${String(player.lives).padStart(2, '0')}  ${weapon}-${player.weaponLevel}`, x + 7, 10);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffce5b';
    ctx.fillText(`AREA ${state.stageIndex + 1}`, 379, 3);
    ctx.fillStyle = '#f0eed8';
    ctx.fillText(`CONTINUE ${state.continues}`, 379, 10);
    ctx.textAlign = 'left';
    const boss = state.enemies.find((enemy) => enemy.kind === 'boss');
    if (boss) this.drawBossBar(boss);
    if (state.linkActiveTicks > 0 || state.linkCharge > 0) this.drawLinkMeter(state);
  }

  private drawBossBar(boss: EnemyState): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4,6,6,.88)'; ctx.fillRect(85, 21, 214, 13);
    ctx.fillStyle = '#d9d9c7'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left'; ctx.fillText(boss.name, 89, 23);
    ctx.fillStyle = '#4e2525'; ctx.fillRect(174, 24, 119, 5);
    ctx.fillStyle = boss.hp / boss.maxHp < 0.45 ? '#ff563f' : '#e7bf4c';
    ctx.fillRect(174, 24, 119 * clamp(boss.hp / boss.maxHp, 0, 1), 5);
  }

  private drawLinkMeter(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3,8,8,.84)'; ctx.fillRect(7, 24, 67, 10);
    ctx.fillStyle = state.linkActiveTicks > 0 ? '#efff61' : '#55dce2';
    ctx.font = 'bold 6px monospace'; ctx.textAlign = 'left';
    ctx.fillText(state.linkActiveTicks > 0 ? 'SYNC FIRE!' : 'SYNC', 10, 26);
    const ratio = state.linkActiveTicks > 0 ? state.linkActiveTicks / LINK_ACTIVE_TICKS : state.linkCharge / LINK_CHARGE_TICKS;
    ctx.fillRect(42, 28, 27 * ratio, 2);
  }

  private drawOffscreenMarkers(state: GameState, localPlayerIndex: number): void {
    const ctx = this.ctx;
    for (const player of state.players) {
      if (player.index === localPlayerIndex || player.status === 'eliminated') continue;
      const sx = player.x - this.cameraX;
      const sy = player.y - this.cameraY;
      if (sx >= 8 && sx <= VIEW_WIDTH - 8 && sy >= 22 && sy <= VIEW_HEIGHT - 8) continue;
      const x = clamp(sx, 8, VIEW_WIDTH - 8);
      const y = clamp(sy, 25, VIEW_HEIGHT - 8);
      ctx.fillStyle = PLAYER_COLORS[player.index] ?? '#fff';
      ctx.beginPath();
      ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x - 4, y + 4); ctx.fill();
    }
  }

  private drawPhaseOverlay(state: GameState, level: LevelDef): void {
    if (state.phase === 'playing') return;
    const ctx = this.ctx;
    if (state.phase === 'briefing') {
      ctx.fillStyle = '#07100de8'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.fillStyle = PALETTES[level.theme].accent; ctx.fillRect(28, 53, 52, 3);
      ctx.fillStyle = '#e8e4cf'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
      ctx.fillText(level.operation, 28, 65);
      ctx.font = 'bold 20px monospace'; ctx.fillText(level.title, 28, 86);
      ctx.fillStyle = '#7e9286'; ctx.font = 'bold 8px monospace'; ctx.fillText(level.subtitle.toUpperCase(), 29, 116);
      ctx.fillStyle = '#d2df59'; ctx.font = 'bold 7px monospace'; ctx.fillText('ENTER / START  ·  DEPLOY EARLY', 29, 150);
      return;
    }
    ctx.fillStyle = 'rgba(2, 5, 5, .76)'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.textAlign = 'center'; ctx.font = 'bold 24px monospace';
    if (state.phase === 'stageClear') {
      ctx.fillStyle = '#dfff67'; ctx.fillText('SECTOR SECURED', VIEW_WIDTH / 2, 92);
      ctx.fillStyle = '#d3d7c6'; ctx.font = 'bold 8px monospace'; ctx.fillText(`KILLS ${state.totalKills}  ·  ADVANCING`, VIEW_WIDTH / 2, 117);
    } else if (state.phase === 'gameOver') {
      ctx.fillStyle = '#ff513b'; ctx.fillText('MISSION FAILED', VIEW_WIDTH / 2, 92);
      ctx.fillStyle = '#d3d7c6'; ctx.font = 'bold 8px monospace'; ctx.fillText('THE VIPER LINE HAS FALLEN', VIEW_WIDTH / 2, 117);
    } else if (state.phase === 'victory') {
      ctx.fillStyle = '#e9ff68'; ctx.fillText('BLACK SUN DOWN', VIEW_WIDTH / 2, 78);
      ctx.fillStyle = '#f2e7c2'; ctx.font = 'bold 12px monospace'; ctx.fillText('OPERATION COMPLETE', VIEW_WIDTH / 2, 107);
      ctx.fillStyle = '#7fcfc2'; ctx.font = 'bold 8px monospace'; ctx.fillText(`TIME ${formatTime(state.elapsedTicks)}  ·  KILLS ${state.totalKills}`, VIEW_WIDTH / 2, 130);
    } else if (state.phase === 'paused') {
      ctx.fillStyle = '#ffdb56'; ctx.fillText('HOLDING FIRE', VIEW_WIDTH / 2, 100);
    }
  }

  private drawCrtMask(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,.035)';
    for (let y = 2; y < VIEW_HEIGHT; y += 4) ctx.fillRect(0, y, VIEW_WIDTH, 1);
  }
}

function formatTime(ticks: number): string {
  const seconds = Math.floor(ticks / TICK_RATE);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
