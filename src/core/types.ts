export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  jump: boolean;
  interact: boolean;
  start: boolean;
  pause: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type Facing = -1 | 1;
export type Aim = 'forward' | 'up' | 'diagUp' | 'diagDown';
export type GamePhase = 'briefing' | 'playing' | 'stageClear' | 'gameOver' | 'victory' | 'paused';
export type PlayerStatus = 'active' | 'downed' | 'respawning' | 'eliminated';
export type WeaponKind = 'rifle' | 'machine' | 'spread' | 'laser';
export type EnemyKind = 'rifleman' | 'runner' | 'turret' | 'sniper' | 'flyer' | 'boss';
export type BossKind = 'wallCannon' | 'reactor' | 'skySerpent' | 'ironViper';
export type PickupKind = WeaponKind | 'barrier' | 'life';
export type ThemeKind = 'jungle' | 'base' | 'waterfall' | 'fortress';
export type StageAxis = 'horizontal' | 'vertical';
