import {
  PLAYER_HEIGHT,
  PLAYER_START_LIVES,
  PLAYER_WIDTH,
  STAGE_INTRO_TICKS,
  TEAM_START_CONTINUES,
} from '../core/constants';
import type {
  Aim,
  BossKind,
  EnemyKind,
  Facing,
  GamePhase,
  PickupKind,
  PlayerStatus,
  WeaponKind,
} from '../core/types';
import { getLevel } from './levels';

export interface PlayerState {
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: Facing;
  aim: Aim;
  status: PlayerStatus;
  lives: number;
  score: number;
  kills: number;
  weapon: WeaponKind;
  weaponLevel: number;
  barrierHits: number;
  onGround: boolean;
  crouching: boolean;
  coyoteTicks: number;
  jumpBufferTicks: number;
  fireCooldown: number;
  invulnTicks: number;
  downedTicks: number;
  reviveProgress: number;
  respawnTicks: number;
  prevJump: boolean;
  prevPause: boolean;
  animationTick: number;
}

export interface BulletState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerPlayer: number | null;
  enemyOwner: number | null;
  fromEnemy: boolean;
  kind: WeaponKind | 'orb' | 'plasma';
  damage: number;
  ttl: number;
  piercing: number;
  hitEnemyIds: number[];
}

export interface EnemyState {
  id: number;
  spawnId: number;
  kind: EnemyKind;
  bossKind: BossKind | null;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  onGround: boolean;
  phase: number;
  age: number;
  drop: PickupKind | null;
  hitFlashTicks: number;
}

export interface PickupState {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  vy: number;
  age: number;
}

export interface ExplosionState {
  id: number;
  x: number;
  y: number;
  size: 'small' | 'large';
  ticks: number;
}

export interface GameState {
  version: 1;
  tick: number;
  rngSeed: number;
  phase: GamePhase;
  previousPhase: GamePhase | null;
  phaseTicks: number;
  stageIndex: number;
  stageTick: number;
  playerCount: number;
  players: PlayerState[];
  bullets: BulletState[];
  enemies: EnemyState[];
  pickups: PickupState[];
  explosions: ExplosionState[];
  spawnedEnemyIds: number[];
  bossSpawned: boolean;
  bossDefeated: boolean;
  checkpointIndex: number;
  checkpointX: number;
  checkpointY: number;
  continues: number;
  linkCharge: number;
  linkActiveTicks: number;
  nextEntityId: number;
  events: string[];
  totalKills: number;
  elapsedTicks: number;
}

export function makePlayer(index: number, x: number, y: number): PlayerState {
  return {
    index,
    x: x + index * 14,
    y,
    vx: 0,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    facing: 1,
    aim: 'forward',
    status: 'active',
    lives: PLAYER_START_LIVES,
    score: 0,
    kills: 0,
    weapon: 'rifle',
    weaponLevel: 1,
    barrierHits: 0,
    onGround: false,
    crouching: false,
    coyoteTicks: 0,
    jumpBufferTicks: 0,
    fireCooldown: 0,
    invulnTicks: 90 + index * 12,
    downedTicks: 0,
    reviveProgress: 0,
    respawnTicks: 0,
    prevJump: false,
    prevPause: false,
    animationTick: 0,
  };
}

export function createGame(playerCount = 1, seed = 0x1a2b3c4d): GameState {
  const count = Math.max(1, Math.min(4, Math.floor(playerCount)));
  const level = getLevel(0);
  const players = Array.from({ length: count }, (_, index) => makePlayer(index, level.spawn.x, level.spawn.y));
  if (count === 1 && players[0]) players[0].barrierHits = 1;
  return {
    version: 1,
    tick: 0,
    rngSeed: seed >>> 0 || 1,
    phase: 'briefing',
    previousPhase: null,
    phaseTicks: STAGE_INTRO_TICKS,
    stageIndex: 0,
    stageTick: 0,
    playerCount: count,
    players,
    bullets: [],
    enemies: [],
    pickups: [],
    explosions: [],
    spawnedEnemyIds: [],
    bossSpawned: false,
    bossDefeated: false,
    checkpointIndex: -1,
    checkpointX: level.spawn.x,
    checkpointY: level.spawn.y,
    continues: TEAM_START_CONTINUES,
    linkCharge: 0,
    linkActiveTicks: 0,
    nextEntityId: 1,
    events: [],
    totalKills: 0,
    elapsedTicks: 0,
  };
}
