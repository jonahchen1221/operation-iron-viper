import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_INPUT } from '../src/core/constants';
import type { InputState } from '../src/core/types';
import { getLevel, type TerrainRect } from '../src/game/levels';
import { createGame } from '../src/game/state';
import { startStage, updateGame } from '../src/game/update';

function soloBotInput(
  state: ReturnType<typeof createGame>,
  memory: { current: TerrainRect | null; jumpTicks: number },
): InputState {
  const level = getLevel(state.stageIndex);
  const player = state.players[0]!;
  const result: InputState = { ...EMPTY_INPUT, fire: true };
  if (state.phase === 'briefing') return { ...result, start: true };
  if (player.status !== 'active') {
    memory.jumpTicks = 0;
    memory.current = null;
    return { ...EMPTY_INPUT };
  }

  const enemy = state.enemies
    .filter((entry) => entry.x > player.x - 80 || level.axis === 'vertical')
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
  if (enemy && enemy.y + enemy.height / 2 < player.y - 10) result.up = true;
  else if (enemy && enemy.y > player.y + player.height + 8 && !player.onGround) result.down = true;

  if (level.axis === 'horizontal') {
    const boss = state.enemies.find((entry) => entry.kind === 'boss');
    if (!boss) result.right = true;
    else {
      const bossDistance = boss.x - player.x;
      if (bossDistance < 100) result.left = true;
      else if (bossDistance > 160) result.right = true;
      else if (state.tick % 150 < 75) result.right = true;
      else result.left = true;
    }
    const liveLaserAhead = level.hazards.find((hazard) =>
      hazard.kind === 'laser' && hazard.x >= player.x + 8 && hazard.x - player.x < 62 &&
      (state.tick + Math.floor(hazard.x)) % 120 < 70,
    );
    if (liveLaserAhead) result.right = false;
    const dangerAhead = level.hazards.some((hazard) => {
      const lookahead = 14;
      return hazard.x < player.x + lookahead && hazard.x + hazard.w > player.x + 8;
    });
    const wallAhead = level.terrain.some((terrain) => terrain.kind === 'wall' && terrain.x < player.x + 32 && terrain.x > player.x);
    const incomingShot = state.bullets.some((bullet) => bullet.fromEnemy && Math.abs(bullet.y - player.y - 10) < 18 && Math.abs(bullet.x - player.x) < 52);
    if (player.onGround && memory.jumpTicks === 0 && (dangerAhead || wallAhead || incomingShot || state.tick % 94 === 0)) {
      memory.jumpTicks = 18;
    }
    if (memory.jumpTicks > 0) {
      result.jump = true;
      memory.jumpTicks--;
    }
    return result;
  }

  // Vertical mission: select the next reachable ledge above the current one, jump toward its center,
  // and aim upward while climbing. This is deliberately a simple input-only bot, not a simulation shortcut.
  const verticalBoss = state.enemies.find((entry) => entry.kind === 'boss');
  if (verticalBoss && player.y < 220) {
    if (state.tick % 180 < 90) result.right = true;
    else result.left = true;
    const incoming = state.bullets.some((bullet) => bullet.fromEnemy && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 55);
    if (player.onGround && incoming && memory.jumpTicks === 0) memory.jumpTicks = 22;
    if (memory.jumpTicks > 0) { result.jump = true; memory.jumpTicks--; }
    result.up = true;
    return result;
  }
  if (
    !memory.current ||
    memory.current.y < player.y - 58 ||
    (player.onGround && Math.abs(player.y - (memory.current.y - player.height)) < 3)
  ) {
    memory.current = level.terrain
      .filter((terrain) => terrain.y < player.y + player.height - 4 && terrain.y >= player.y - 58)
      .sort((a, b) => b.y - a.y)[0] ?? null;
  }
  const target = memory.current;
  if (target) {
    const center = target.x + target.w / 2;
    const playerCenter = player.x + player.width / 2;
    if (playerCenter < center - 4) result.right = true;
    else if (playerCenter > center + 4) result.left = true;
    if (player.onGround && memory.jumpTicks === 0) {
      const support = level.terrain.find((terrain) =>
        Math.abs(player.y + player.height - terrain.y) < 3 &&
        player.x + player.width > terrain.x && player.x < terrain.x + terrain.w,
      );
      const targetOverlaps = player.x + player.width > target.x && player.x < target.x + target.w;
      const atTakeoffEdge = !support || targetOverlaps ||
        (center > playerCenter
          ? player.x + player.width >= support.x + support.w - 5
          : player.x <= support.x + 5);
      if (atTakeoffEdge) memory.jumpTicks = 22;
    }
  }
  if (memory.jumpTicks > 0) { result.jump = true; memory.jumpTicks--; }
  result.up = true;
  return result;
}

test('an input-only solo bot can clear every sector using normal controls', () => {
  for (let stageIndex = 0; stageIndex < 4; stageIndex++) {
    const state = createGame(1, 0x4711 + stageIndex);
    if (stageIndex > 0) startStage(state, stageIndex);
    const targetPlatform = { current: null as TerrainRect | null, jumpTicks: 0 };
    let ticks = 0;
    while (state.phase !== 'stageClear' && state.phase !== 'gameOver' && ticks++ < 36_000) {
      updateGame(state, [soloBotInput(state, targetPlatform)]);
    }
    assert.equal(
      state.phase,
      'stageClear',
      `sector ${stageIndex + 1} did not clear after ${ticks} ticks: ${JSON.stringify({ player: state.players[0], continues: state.continues, boss: state.enemies.find((enemy) => enemy.kind === 'boss'), checkpoint: state.checkpointIndex })}`,
    );
    assert.ok(state.continues >= 0);
  }
});
