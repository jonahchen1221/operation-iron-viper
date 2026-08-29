import {
  BULLET_SIZE,
  COYOTE_TICKS,
  DOWNED_TICKS,
  EMPTY_INPUT,
  ENEMY_BULLET_SPEED,
  GAME_OVER_DELAY_TICKS,
  GRAVITY,
  JUMP_BUFFER_TICKS,
  JUMP_SPEED,
  LINK_ACTIVE_TICKS,
  LINK_CHARGE_TICKS,
  LINK_DISTANCE,
  MAX_ENEMY_BULLETS,
  MAX_FALL_SPEED,
  MAX_PLAYER_BULLETS,
  PLAYER_AIR_SPEED,
  PLAYER_BULLET_SPEED,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_START_LIVES,
  RESPAWN_INVULN_TICKS,
  RESPAWN_TICKS,
  REVIVE_TICKS,
  STAGE_CLEAR_TICKS,
  STAGE_INTRO_TICKS,
  VIEW_WIDTH,
} from '../core/constants';
import type { InputState, Rect, WeaponKind } from '../core/types';
import { randomRange } from '../core/rng';
import { getLevel, stageProgress, type EnemySpawn, type LevelDef, type TerrainRect } from './levels';
import {
  makePlayer,
  type BulletState,
  type EnemyState,
  type GameState,
  type PlayerState,
} from './state';

const inputOrEmpty = (input: InputState | undefined): InputState => input ?? { ...EMPTY_INPUT };

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function centerDistance(a: Rect, b: Rect): number {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  return Math.hypot(ax - bx, ay - by);
}

function playerRect(player: PlayerState): Rect {
  return { x: player.x, y: player.y, w: player.width, h: player.height };
}

function enemyRect(enemy: EnemyState): Rect {
  return { x: enemy.x, y: enemy.y, w: enemy.width, h: enemy.height };
}

function isSolidFromSide(terrain: TerrainRect): boolean {
  return terrain.kind !== 'platform' && terrain.kind !== 'bridge';
}

function moveBody(
  body: { x: number; y: number; vx: number; vy: number; width: number; height: number; onGround: boolean },
  level: LevelDef,
): void {
  body.x += body.vx;
  for (const tile of level.terrain) {
    if (!isSolidFromSide(tile) || !intersects({ x: body.x, y: body.y, w: body.width, h: body.height }, tile)) continue;
    if (body.vx > 0) body.x = tile.x - body.width;
    else if (body.vx < 0) body.x = tile.x + tile.w;
    body.vx = 0;
  }
  body.x = Math.max(0, Math.min(level.width - body.width, body.x));

  const previousBottom = body.y + body.height;
  body.y += body.vy;
  body.onGround = false;
  for (const tile of level.terrain) {
    const rect = { x: body.x, y: body.y, w: body.width, h: body.height };
    if (!intersects(rect, tile)) continue;
    const oneWay = tile.kind === 'platform' || tile.kind === 'bridge';
    if (body.vy >= 0 && previousBottom <= tile.y + 2) {
      body.y = tile.y - body.height;
      body.vy = 0;
      body.onGround = true;
    } else if (!oneWay && body.vy < 0) {
      body.y = tile.y + tile.h;
      body.vy = 0;
    }
  }
}

function nextId(state: GameState): number {
  return state.nextEntityId++;
}

function emit(state: GameState, event: string): void {
  state.events.push(event);
}

function randomCooldown(state: GameState, min: number, max: number): number {
  const random = randomRange(state.rngSeed, min, max);
  state.rngSeed = random.seed;
  return Math.floor(random.value);
}

function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => player.status === 'active');
}

function nearestPlayer(state: GameState, enemy: EnemyState): PlayerState | null {
  let nearest: PlayerState | null = null;
  let distance = Infinity;
  for (const player of state.players) {
    if (player.status !== 'active') continue;
    const d = centerDistance(enemyRect(enemy), playerRect(player));
    if (d < distance) {
      distance = d;
      nearest = player;
    }
  }
  return nearest;
}

function currentProgress(state: GameState, level: LevelDef): number {
  const alive = activePlayers(state);
  if (alive.length === 0) return stageProgress(level, state.checkpointX, state.checkpointY);
  if (level.axis === 'horizontal') return Math.max(...alive.map((player) => player.x));
  return Math.max(...alive.map((player) => level.height - player.y));
}

function updatePause(state: GameState, inputs: InputState[]): boolean {
  let pressed = false;
  for (const player of state.players) {
    const input = inputOrEmpty(inputs[player.index]);
    if (input.pause && !player.prevPause) pressed = true;
    player.prevPause = input.pause;
  }
  if (!pressed) return state.phase === 'paused';
  if (state.phase === 'playing') {
    state.previousPhase = state.phase;
    state.phase = 'paused';
    emit(state, 'pause');
    return true;
  }
  if (state.phase === 'paused') {
    state.phase = state.previousPhase ?? 'playing';
    state.previousPhase = null;
    emit(state, 'resume');
    return false;
  }
  return false;
}

export function updateGame(state: GameState, inputs: InputState[]): void {
  state.events = [];
  state.tick++;

  if (updatePause(state, inputs)) return;
  if (state.phase === 'paused') return;

  if (state.phase === 'briefing') {
    state.phaseTicks--;
    if (state.phaseTicks <= 0 || inputs.some((input) => input?.start)) {
      state.phase = 'playing';
      state.phaseTicks = 0;
      emit(state, 'missionStart');
    }
    return;
  }
  if (state.phase === 'stageClear') {
    state.phaseTicks--;
    if (state.phaseTicks <= 0) {
      if (state.stageIndex >= 3) {
        state.phase = 'victory';
        emit(state, 'victory');
      } else {
        startStage(state, state.stageIndex + 1);
      }
    }
    return;
  }
  if (state.phase === 'gameOver') {
    if (state.phaseTicks > 0) state.phaseTicks--;
    return;
  }
  if (state.phase === 'victory') return;

  state.stageTick++;
  state.elapsedTicks++;
  const level = getLevel(state.stageIndex);

  updatePlayers(state, inputs, level);
  updateRevivesAndRespawns(state, inputs);
  updateCheckpoints(state, level);
  spawnTriggeredEnemies(state, level);
  updateEnemies(state, level);
  updateBullets(state, level);
  updatePickups(state, level);
  updateExplosions(state);
  updateLink(state, inputs);
  resolveHazardsAndContact(state, level);
  resolveTeamFailure(state);
  resolveStageClear(state);
}

function updatePlayers(state: GameState, inputs: InputState[], level: LevelDef): void {
  for (const player of state.players) {
    if (player.status !== 'active') continue;
    const input = inputOrEmpty(inputs[player.index]);
    player.animationTick++;
    if (player.invulnTicks > 0) player.invulnTicks--;
    if (player.fireCooldown > 0) player.fireCooldown--;

    if (input.left !== input.right) {
      player.facing = input.left ? -1 : 1;
      player.vx = player.facing * (player.onGround ? PLAYER_SPEED : PLAYER_AIR_SPEED);
    } else {
      player.vx *= player.onGround ? 0.55 : 0.92;
      if (Math.abs(player.vx) < 0.04) player.vx = 0;
    }

    player.crouching = input.down && player.onGround;
    if (input.up) player.aim = input.left || input.right ? 'diagUp' : 'up';
    else if (input.down && !player.onGround) player.aim = 'diagDown';
    else player.aim = 'forward';

    const jumpPressed = input.jump && !player.prevJump;
    player.prevJump = input.jump;
    if (jumpPressed) player.jumpBufferTicks = JUMP_BUFFER_TICKS;
    else if (player.jumpBufferTicks > 0) player.jumpBufferTicks--;
    if (player.onGround) player.coyoteTicks = COYOTE_TICKS;
    else if (player.coyoteTicks > 0) player.coyoteTicks--;
    if (player.jumpBufferTicks > 0 && player.coyoteTicks > 0) {
      player.vy = JUMP_SPEED;
      player.onGround = false;
      player.coyoteTicks = 0;
      player.jumpBufferTicks = 0;
      emit(state, 'jump');
    }
    if (!input.jump && player.vy < -1.6) player.vy *= 0.84;

    player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY);
    moveBody(player, level);
    if (player.crouching) player.vx = 0;

    if (input.fire && player.fireCooldown <= 0) firePlayerWeapon(state, player);
    if (player.y > level.height + 40) downPlayer(state, player);
  }
}

function aimVector(player: PlayerState): { x: number; y: number } {
  if (player.aim === 'up') return { x: 0, y: -1 };
  if (player.aim === 'diagUp') return { x: player.facing * 0.707, y: -0.707 };
  if (player.aim === 'diagDown') return { x: player.facing * 0.707, y: 0.707 };
  return { x: player.facing, y: 0 };
}

function bulletCountFor(state: GameState, index: number): number {
  return state.bullets.filter((bullet) => !bullet.fromEnemy && bullet.ownerPlayer === index).length;
}

function addPlayerBullet(
  state: GameState,
  player: PlayerState,
  vx: number,
  vy: number,
  damage: number,
  kind: WeaponKind,
  piercing = 0,
): void {
  state.bullets.push({
    id: nextId(state),
    x: player.x + player.width / 2 - BULLET_SIZE / 2 + Math.sign(vx) * 6,
    y: player.y + (player.crouching ? 16 : 9),
    vx,
    vy,
    ownerPlayer: player.index,
    enemyOwner: null,
    fromEnemy: false,
    kind,
    damage,
    ttl: 105,
    piercing,
    hitEnemyIds: [],
  });
}

function firePlayerWeapon(state: GameState, player: PlayerState): void {
  if (bulletCountFor(state, player.index) >= MAX_PLAYER_BULLETS / state.playerCount) return;
  const aim = aimVector(player);
  const boost = state.linkActiveTicks > 0;
  const speed = PLAYER_BULLET_SPEED + (boost ? 0.55 : 0);
  const damage = 1 + (boost ? 1 : 0) + (player.weaponLevel >= 3 ? 1 : 0);
  if (player.weapon === 'spread') {
    const base = Math.atan2(aim.y, aim.x);
    const angles = player.weaponLevel >= 2 ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.18, 0, 0.18];
    for (const offset of angles) {
      addPlayerBullet(state, player, Math.cos(base + offset) * speed, Math.sin(base + offset) * speed, damage, 'spread');
    }
    player.fireCooldown = boost ? 13 : 19;
  } else if (player.weapon === 'laser') {
    addPlayerBullet(state, player, aim.x * (speed + 1), aim.y * (speed + 1), damage + 1, 'laser', 2 + player.weaponLevel);
    player.fireCooldown = boost ? 12 : 18;
  } else {
    addPlayerBullet(state, player, aim.x * speed, aim.y * speed, damage, player.weapon);
    player.fireCooldown = player.weapon === 'machine' ? (boost ? 3 : 6) : (boost ? 7 : 11);
  }
  emit(state, player.weapon === 'laser' ? 'laser' : 'playerFire');
}

function spawnTriggeredEnemies(state: GameState, level: LevelDef): void {
  const progress = currentProgress(state, level);
  for (const spawn of level.enemies) {
    if (spawn.trigger > progress + VIEW_WIDTH * 0.35 || state.spawnedEnemyIds.includes(spawn.id)) continue;
    state.spawnedEnemyIds.push(spawn.id);
    spawnEnemy(state, spawn);
    if (state.playerCount >= 3 && spawn.id % 3 === 1) {
      spawnEnemy(state, { ...spawn, id: spawn.id + 10_000, x: spawn.x + 26, drop: undefined });
    }
  }
  if (!state.bossSpawned && progress >= level.boss.trigger) spawnBoss(state, level);
}

function spawnEnemy(state: GameState, spawn: EnemySpawn): void {
  const baseHp = spawn.kind === 'turret' ? 3 : spawn.kind === 'sniper' || spawn.kind === 'flyer' ? 2 : 1;
  const bonusHp = state.playerCount === 4 && baseHp > 1 ? 1 : 0;
  const size = spawn.kind === 'flyer' ? { w: 18, h: 12 } : spawn.kind === 'turret' ? { w: 16, h: 16 } : { w: 12, h: 22 };
  state.enemies.push({
    id: nextId(state),
    spawnId: spawn.id,
    kind: spawn.kind,
    bossKind: null,
    name: '',
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    width: size.w,
    height: size.h,
    facing: -1,
    hp: baseHp + bonusHp,
    maxHp: baseHp + bonusHp,
    fireCooldown: randomCooldown(state, 45, 105),
    onGround: false,
    phase: 0,
    age: 0,
    drop: spawn.drop ?? null,
    hitFlashTicks: 0,
  });
}

function spawnBoss(state: GameState, level: LevelDef): void {
  state.bossSpawned = true;
  const spec = level.boss;
  const sizes = {
    wallCannon: { w: 44, h: 64 },
    reactor: { w: 48, h: 62 },
    skySerpent: { w: 58, h: 26 },
    ironViper: { w: 34, h: 50 },
  } as const;
  const size = sizes[spec.kind];
  const hp = spec.baseHp + Math.round(spec.baseHp * 0.48 * (state.playerCount - 1));
  state.enemies.push({
    id: nextId(state),
    spawnId: -1,
    kind: 'boss',
    bossKind: spec.kind,
    name: spec.name,
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    width: size.w,
    height: size.h,
    facing: -1,
    hp,
    maxHp: hp,
    fireCooldown: 80,
    onGround: spec.kind !== 'skySerpent',
    phase: 0,
    age: 0,
    drop: null,
    hitFlashTicks: 0,
  });
  emit(state, 'bossAlarm');
}

function updateEnemies(state: GameState, level: LevelDef): void {
  for (const enemy of state.enemies) {
    enemy.age++;
    if (enemy.hitFlashTicks > 0) enemy.hitFlashTicks--;
    if (enemy.fireCooldown > 0) enemy.fireCooldown--;
    const target = nearestPlayer(state, enemy);
    if (!target) continue;

    if (enemy.kind === 'boss') {
      updateBoss(state, enemy, target, level);
      continue;
    }

    enemy.facing = target.x < enemy.x ? -1 : 1;
    if (enemy.kind === 'rifleman' || enemy.kind === 'runner') {
      const speed = enemy.kind === 'runner' ? 0.92 : 0.48;
      enemy.vx = enemy.facing * speed;
      if (enemy.onGround && Math.abs(target.y - enemy.y) > 30 && enemy.age % 90 === 0) enemy.vy = -3.7;
      if (enemy.kind === 'rifleman' && enemy.fireCooldown <= 0 && centerDistance(enemyRect(enemy), playerRect(target)) < 240) {
        fireEnemyAimed(state, enemy, 1);
        enemy.fireCooldown = randomCooldown(state, 88, 140) - state.playerCount * 3;
      }
    } else if (enemy.kind === 'sniper' && enemy.fireCooldown <= 0) {
      fireEnemyAimed(state, enemy, 1.25);
      enemy.fireCooldown = randomCooldown(state, 105, 150);
    } else if (enemy.kind === 'turret' && enemy.fireCooldown <= 0) {
      fireEnemyAimed(state, enemy, 1.05);
      enemy.fireCooldown = randomCooldown(state, 72, 112);
    } else if (enemy.kind === 'flyer') {
      enemy.vx = enemy.facing * 0.68;
      enemy.y += Math.sin((enemy.age + enemy.id * 9) / 19) * 0.46;
      if (enemy.fireCooldown <= 0) {
        fireEnemyAimed(state, enemy, 0.92);
        enemy.fireCooldown = randomCooldown(state, 85, 130);
      }
      enemy.x += enemy.vx;
      continue;
    }

    enemy.vy = Math.min(MAX_FALL_SPEED, enemy.vy + GRAVITY);
    moveBody(enemy, level);
  }
}

function updateBoss(state: GameState, boss: EnemyState, target: PlayerState, level: LevelDef): void {
  const healthRatio = boss.hp / boss.maxHp;
  const enraged = healthRatio < 0.45;
  const soloRelief = state.playerCount === 1 ? 22 : 0;
  boss.facing = target.x < boss.x ? -1 : 1;
  if (boss.bossKind === 'wallCannon') {
    if (boss.fireCooldown <= 0) {
      fireEnemyFan(state, boss, target, enraged ? 5 : 3, 0.16, 'plasma');
      boss.fireCooldown = (enraged ? 48 : 70) + soloRelief;
    }
  } else if (boss.bossKind === 'reactor') {
    if (boss.fireCooldown <= 0) {
      if (boss.phase++ % 3 === 2) fireEnemyRadial(state, boss, enraged ? 12 : 8);
      else fireEnemyFan(state, boss, target, enraged ? 5 : 3, 0.2, 'orb');
      boss.fireCooldown = (enraged ? 52 : 76) + soloRelief;
    }
  } else if (boss.bossKind === 'skySerpent') {
    const arenaLeft = 28;
    const arenaRight = level.width - boss.width - 28;
    boss.vx = Math.sin(boss.age / 75) * (enraged ? 1.6 : 1.15);
    boss.x = Math.max(arenaLeft, Math.min(arenaRight, boss.x + boss.vx));
    boss.y = 100 + Math.sin(boss.age / 28) * 25;
    if (boss.fireCooldown <= 0) {
      fireEnemyFan(state, boss, target, enraged ? 5 : 3, 0.22, 'orb');
      boss.fireCooldown = (enraged ? 42 : 64) + soloRelief;
    }
  } else if (boss.bossKind === 'ironViper') {
    const distance = target.x - boss.x;
    boss.vx = Math.sign(distance) * (enraged ? 0.92 : 0.62);
    if (boss.onGround && boss.age % (enraged ? 90 : 130) === 0) boss.vy = -4.25;
    boss.vy = Math.min(MAX_FALL_SPEED, boss.vy + GRAVITY);
    moveBody(boss, level);
    if (boss.fireCooldown <= 0) {
      if (boss.phase++ % 4 === 3) fireEnemyRadial(state, boss, enraged ? 14 : 10);
      else fireEnemyFan(state, boss, target, enraged ? 5 : 3, 0.13, 'plasma');
      boss.fireCooldown = (enraged ? 37 : 58) + soloRelief;
    }
  }
}

function addEnemyBullet(
  state: GameState,
  enemy: EnemyState,
  vx: number,
  vy: number,
  kind: 'orb' | 'plasma' = 'orb',
): void {
  if (state.bullets.filter((bullet) => bullet.fromEnemy).length >= MAX_ENEMY_BULLETS) return;
  state.bullets.push({
    id: nextId(state),
    x: enemy.x + enemy.width / 2,
    y: enemy.y + enemy.height / 2,
    vx,
    vy,
    ownerPlayer: null,
    enemyOwner: enemy.id,
    fromEnemy: true,
    kind,
    damage: 1,
    ttl: 180,
    piercing: 0,
    hitEnemyIds: [],
  });
}

function fireEnemyAimed(state: GameState, enemy: EnemyState, speedScale: number): void {
  const target = nearestPlayer(state, enemy);
  if (!target) return;
  const dx = target.x + target.width / 2 - (enemy.x + enemy.width / 2);
  const dy = target.y + target.height / 2 - (enemy.y + enemy.height / 2);
  const length = Math.max(1, Math.hypot(dx, dy));
  const speed = enemyBulletSpeed(state) * speedScale;
  addEnemyBullet(state, enemy, (dx / length) * speed, (dy / length) * speed);
  emit(state, 'enemyFire');
}

function fireEnemyFan(
  state: GameState,
  enemy: EnemyState,
  target: PlayerState,
  count: number,
  spread: number,
  kind: 'orb' | 'plasma',
): void {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const base = Math.atan2(dy, dx);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * spread;
    const speed = enemyBulletSpeed(state);
    addEnemyBullet(state, enemy, Math.cos(angle) * speed, Math.sin(angle) * speed, kind);
  }
  emit(state, 'bossFire');
}

function fireEnemyRadial(state: GameState, enemy: EnemyState, count: number): void {
  const speed = 1.45 + (state.playerCount - 1) * 0.11;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + enemy.phase * 0.13;
    addEnemyBullet(state, enemy, Math.cos(angle) * speed, Math.sin(angle) * speed, 'plasma');
  }
  emit(state, 'bossBurst');
}

function enemyBulletSpeed(state: GameState): number {
  return ENEMY_BULLET_SPEED - (4 - state.playerCount) * 0.15;
}

function updateBullets(state: GameState, level: LevelDef): void {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.ttl--;
    const rect = { x: bullet.x, y: bullet.y, w: BULLET_SIZE, h: BULLET_SIZE };
    if (bullet.x < -8 || bullet.x > level.width + 8 || bullet.y < -8 || bullet.y > level.height + 8) {
      bullet.ttl = 0;
      continue;
    }
    if (level.terrain.some((terrain) => intersects(rect, terrain))) {
      bullet.ttl = 0;
      state.explosions.push({ id: nextId(state), x: bullet.x, y: bullet.y, size: 'small', ticks: 12 });
      continue;
    }
    if (bullet.fromEnemy) {
      for (const player of state.players) {
        if (player.status === 'active' && intersects(rect, playerRect(player))) {
          bullet.ttl = 0;
          downPlayer(state, player);
          break;
        }
      }
    } else {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || bullet.hitEnemyIds.includes(enemy.id) || !intersects(rect, enemyRect(enemy))) continue;
        bullet.hitEnemyIds.push(enemy.id);
        enemy.hp -= bullet.damage;
        enemy.hitFlashTicks = 5;
        if (enemy.hp <= 0) defeatEnemy(state, enemy, bullet.ownerPlayer);
        if (bullet.piercing > 0) bullet.piercing--;
        else bullet.ttl = 0;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.ttl > 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function defeatEnemy(state: GameState, enemy: EnemyState, owner: number | null): void {
  state.explosions.push({
    id: nextId(state),
    x: enemy.x + enemy.width / 2,
    y: enemy.y + enemy.height / 2,
    size: enemy.kind === 'boss' ? 'large' : 'small',
    ticks: enemy.kind === 'boss' ? 54 : 20,
  });
  if (owner !== null) {
    const player = state.players[owner];
    if (player) {
      player.kills++;
      player.score += enemy.kind === 'boss' ? 10_000 : enemy.kind === 'turret' ? 500 : 200;
    }
  }
  state.totalKills++;
  if (enemy.drop) {
    state.pickups.push({ id: nextId(state), kind: enemy.drop, x: enemy.x, y: enemy.y, vy: -1.8, age: 0 });
  }
  if (enemy.kind === 'boss') {
    state.bossDefeated = true;
    state.bullets = state.bullets.filter((bullet) => !bullet.fromEnemy);
    emit(state, 'bossDown');
  } else {
    emit(state, 'enemyDown');
  }
}

export function downPlayer(state: GameState, player: PlayerState): void {
  if (player.status !== 'active' || player.invulnTicks > 0) return;
  if (player.barrierHits > 0) {
    player.barrierHits--;
    player.invulnTicks = 55;
    emit(state, 'barrierHit');
    return;
  }
  player.status = 'downed';
  player.downedTicks = 0;
  player.reviveProgress = 0;
  player.vx = 0;
  player.vy = 0;
  emit(state, 'playerDown');
}

function updateRevivesAndRespawns(state: GameState, inputs: InputState[]): void {
  const rescuers = activePlayers(state);
  for (const player of state.players) {
    if (player.status === 'downed') {
      const noRescuerAlive = rescuers.length === 0;
      player.downedTicks += noRescuerAlive ? 4 : 1;
      let helped = false;
      for (const rescuer of rescuers) {
        if (!inputOrEmpty(inputs[rescuer.index]).interact) continue;
        if (centerDistance(playerRect(player), playerRect(rescuer)) > 30) continue;
        player.reviveProgress++;
        helped = true;
        if (player.reviveProgress >= REVIVE_TICKS) {
          player.status = 'active';
          player.downedTicks = 0;
          player.reviveProgress = 0;
          player.invulnTicks = RESPAWN_INVULN_TICKS;
          player.y -= 2;
          rescuer.score += 750;
          emit(state, 'revive');
          break;
        }
      }
      if (!helped) player.reviveProgress = Math.max(0, player.reviveProgress - 1);
      if (player.status === 'downed' && player.downedTicks >= DOWNED_TICKS) loseLife(state, player);
    } else if (player.status === 'respawning') {
      player.respawnTicks--;
      if (player.respawnTicks <= 0) respawnPlayer(state, player);
    }
  }
}

function loseLife(state: GameState, player: PlayerState): void {
  player.lives--;
  player.reviveProgress = 0;
  if (player.lives > 0) {
    player.status = 'respawning';
    player.respawnTicks = RESPAWN_TICKS;
  } else {
    player.status = 'eliminated';
  }
  emit(state, 'lifeLost');
}

function respawnPlayer(state: GameState, player: PlayerState): void {
  player.status = 'active';
  player.x = state.checkpointX + player.index * 14;
  player.y = state.checkpointY;
  player.vx = 0;
  player.vy = 0;
  player.weapon = 'rifle';
  player.weaponLevel = 1;
  player.barrierHits = state.playerCount === 1 ? 1 : 0;
  player.invulnTicks = RESPAWN_INVULN_TICKS;
  player.downedTicks = 0;
  emit(state, 'respawn');
}

function updatePickups(state: GameState, level: LevelDef): void {
  for (const pickup of state.pickups) {
    pickup.age++;
    pickup.vy = Math.min(2.4, pickup.vy + GRAVITY * 0.55);
    const previousY = pickup.y;
    pickup.y += pickup.vy;
    for (const terrain of level.terrain) {
      if (pickup.vy >= 0 && previousY + 10 <= terrain.y + 2 && intersects({ x: pickup.x, y: pickup.y, w: 10, h: 10 }, terrain)) {
        pickup.y = terrain.y - 10;
        pickup.vy = 0;
      }
    }
    for (const player of state.players) {
      if (player.status !== 'active' || !intersects({ x: pickup.x, y: pickup.y, w: 10, h: 10 }, playerRect(player))) continue;
      applyPickup(state, player, pickup.kind);
      pickup.age = 9999;
      break;
    }
  }
  state.pickups = state.pickups.filter((pickup) => pickup.age < 900);
}

function applyPickup(state: GameState, player: PlayerState, kind: WeaponKind | 'barrier' | 'life'): void {
  if (kind === 'barrier') player.barrierHits = Math.min(3, player.barrierHits + 2);
  else if (kind === 'life') player.lives = Math.min(5, player.lives + 1);
  else if (player.weapon === kind) player.weaponLevel = Math.min(3, player.weaponLevel + 1);
  else {
    player.weapon = kind;
    player.weaponLevel = 1;
  }
  player.score += 500;
  emit(state, 'pickup');
}

function updateExplosions(state: GameState): void {
  for (const explosion of state.explosions) explosion.ticks--;
  state.explosions = state.explosions.filter((explosion) => explosion.ticks > 0);
}

function updateLink(state: GameState, inputs: InputState[]): void {
  if (state.linkActiveTicks > 0) {
    state.linkActiveTicks--;
    return;
  }
  const firing = activePlayers(state).filter((player) => inputOrEmpty(inputs[player.index]).fire);
  let linked = false;
  for (let i = 0; i < firing.length; i++) {
    for (let j = i + 1; j < firing.length; j++) {
      const a = firing[i];
      const b = firing[j];
      if (a && b && centerDistance(playerRect(a), playerRect(b)) <= LINK_DISTANCE) linked = true;
    }
  }
  state.linkCharge = linked ? Math.min(LINK_CHARGE_TICKS, state.linkCharge + 2) : Math.max(0, state.linkCharge - 1);
  if (state.linkCharge >= LINK_CHARGE_TICKS) {
    state.linkCharge = 0;
    state.linkActiveTicks = LINK_ACTIVE_TICKS;
    emit(state, 'linkActive');
  }
}

function resolveHazardsAndContact(state: GameState, level: LevelDef): void {
  for (const player of state.players) {
    if (player.status !== 'active') continue;
    const rect = playerRect(player);
    if (level.hazards.some((hazard) => hazardIsActive(hazard, state.tick) && intersects(rect, hazard))) downPlayer(state, player);
    if (player.invulnTicks <= 0 && state.enemies.some((enemy) => intersects(rect, enemyRect(enemy)))) downPlayer(state, player);
  }
}

function hazardIsActive(hazard: LevelDef['hazards'][number], tick: number): boolean {
  if (hazard.kind !== 'laser') return true;
  return (tick + Math.floor(hazard.x)) % 120 < 70;
}

function updateCheckpoints(state: GameState, level: LevelDef): void {
  const progress = currentProgress(state, level);
  const nextCheckpoint = level.checkpoints[state.checkpointIndex + 1];
  if (!nextCheckpoint || progress < nextCheckpoint.progress) return;
  state.checkpointIndex++;
  state.checkpointX = nextCheckpoint.x;
  state.checkpointY = nextCheckpoint.y;
  emit(state, 'checkpoint');
}

function resolveTeamFailure(state: GameState): void {
  if (!state.players.every((player) => player.status === 'eliminated')) return;
  if (state.continues > 0) {
    state.continues--;
    state.bullets = [];
    state.pickups = [];
    state.enemies = state.enemies.filter((enemy) => enemy.kind === 'boss');
    for (const player of state.players) {
      player.lives = PLAYER_START_LIVES;
      player.status = 'respawning';
      player.respawnTicks = RESPAWN_TICKS;
    }
    emit(state, 'continueUsed');
  } else {
    state.phase = 'gameOver';
    state.phaseTicks = GAME_OVER_DELAY_TICKS;
    emit(state, 'gameOver');
  }
}

function resolveStageClear(state: GameState): void {
  if (!state.bossDefeated || state.phase !== 'playing') return;
  state.phase = 'stageClear';
  state.phaseTicks = STAGE_CLEAR_TICKS;
  state.bullets = [];
  for (const player of state.players) {
    player.score += 2_500 + player.lives * 250;
    player.lives = Math.min(PLAYER_START_LIVES, Math.max(1, player.lives + 1));
  }
  emit(state, 'stageClear');
}

export function startStage(state: GameState, stageIndex: number): void {
  const level = getLevel(stageIndex);
  state.stageIndex = stageIndex;
  state.stageTick = 0;
  state.phase = 'briefing';
  state.phaseTicks = STAGE_INTRO_TICKS;
  state.bullets = [];
  state.enemies = [];
  state.pickups = [];
  state.explosions = [];
  state.spawnedEnemyIds = [];
  state.bossSpawned = false;
  state.bossDefeated = false;
  state.checkpointIndex = -1;
  state.checkpointX = level.spawn.x;
  state.checkpointY = level.spawn.y;
  state.linkCharge = 0;
  state.linkActiveTicks = 0;
  state.players = state.players.map((old) => {
    const player = makePlayer(old.index, level.spawn.x, level.spawn.y);
    player.score = old.score;
    player.kills = old.kills;
    player.lives = Math.min(PLAYER_START_LIVES, Math.max(1, old.lives));
    player.weapon = old.weapon;
    player.weaponLevel = old.weaponLevel;
    if (state.playerCount === 1) player.barrierHits = 1;
    return player;
  });
}
