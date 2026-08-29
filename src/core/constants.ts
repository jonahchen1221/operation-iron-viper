export const TICK_RATE = 60;
export const SNAPSHOT_RATE = 15;
export const VIEW_WIDTH = 384;
export const VIEW_HEIGHT = 216;

export const PLAYER_WIDTH = 12;
export const PLAYER_HEIGHT = 24;
export const PLAYER_SPEED = 1.45;
export const PLAYER_AIR_SPEED = 1.45;
export const JUMP_SPEED = -4.85;
export const GRAVITY = 0.235;
export const MAX_FALL_SPEED = 5.25;
export const COYOTE_TICKS = 7;
export const JUMP_BUFFER_TICKS = 7;

export const PLAYER_START_LIVES = 3;
export const TEAM_START_CONTINUES = 3;
export const DOWNED_TICKS = 360;
export const REVIVE_TICKS = 90;
export const RESPAWN_TICKS = 75;
export const RESPAWN_INVULN_TICKS = 150;

export const BULLET_SIZE = 3;
export const PLAYER_BULLET_SPEED = 4.8;
export const ENEMY_BULLET_SPEED = 2.15;
export const MAX_PLAYER_BULLETS = 28;
export const MAX_ENEMY_BULLETS = 36;

export const LINK_DISTANCE = 84;
export const LINK_CHARGE_TICKS = 150;
export const LINK_ACTIVE_TICKS = 360;

export const STAGE_INTRO_TICKS = 150;
export const STAGE_CLEAR_TICKS = 210;
export const GAME_OVER_DELAY_TICKS = 90;

export const PLAYER_COLORS = ['#ffdc59', '#56e6ff', '#ff6e64', '#b4ff68'] as const;
export const PLAYER_DARK_COLORS = ['#a56826', '#176da6', '#9b3140', '#4d8f32'] as const;

export const EMPTY_INPUT = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  jump: false,
  interact: false,
  start: false,
  pause: false,
} as const;
