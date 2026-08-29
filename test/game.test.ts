import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_INPUT, REVIVE_TICKS } from '../src/core/constants';
import type { InputState } from '../src/core/types';
import { LEVELS } from '../src/game/levels';
import { createGame } from '../src/game/state';
import { downPlayer, startStage, updateGame } from '../src/game/update';

const input = (partial: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...partial });

function begin(playerCount = 1) {
  const state = createGame(playerCount, 123456);
  updateGame(state, [input({ start: true })]);
  assert.equal(state.phase, 'playing');
  return state;
}

test('game state is JSON serializable and contains one to four soldiers', () => {
  for (const count of [1, 2, 4]) {
    const state = createGame(count, 42);
    const parsed = JSON.parse(JSON.stringify(state));
    assert.equal(parsed.playerCount, count);
    assert.equal(parsed.players.length, count);
  }
});

test('the same seed and inputs produce an identical simulation', () => {
  const first = begin(2);
  const second = begin(2);
  for (let tick = 0; tick < 420; tick++) {
    const inputs = [
      input({ right: tick < 300, fire: tick % 3 === 0, jump: tick === 90 }),
      input({ right: tick < 280, fire: tick % 5 === 0, jump: tick === 120 }),
    ];
    updateGame(first, inputs);
    updateGame(second, inputs);
  }
  assert.deepEqual(second, first);
});

test('a nearby teammate can rescue a downed soldier without spending a life', () => {
  const state = begin(2);
  const rescuer = state.players[0]!;
  const downed = state.players[1]!;
  rescuer.x = 45;
  downed.x = 55;
  downed.invulnTicks = 0;
  downPlayer(state, downed);
  assert.equal(downed.status, 'downed');
  const lives = downed.lives;
  for (let tick = 0; tick < REVIVE_TICKS + 2; tick++) {
    updateGame(state, [input({ interact: true }), input()]);
  }
  assert.equal(downed.status, 'active');
  assert.equal(downed.lives, lives);
  assert.ok(rescuer.score >= 750);
});

test('an eliminated squad spends a shared continue and can also reach game over', () => {
  const withContinue = begin(2);
  withContinue.continues = 1;
  for (const player of withContinue.players) player.status = 'eliminated';
  updateGame(withContinue, [input(), input()]);
  assert.equal(withContinue.continues, 0);
  assert.ok(withContinue.players.every((player) => player.status === 'respawning'));

  const doomed = begin(1);
  doomed.continues = 0;
  doomed.players[0]!.status = 'eliminated';
  updateGame(doomed, [input()]);
  assert.equal(doomed.phase, 'gameOver');
});

test('boss health scales with squad size', () => {
  const solo = begin(1);
  solo.players[0]!.x = 2000;
  updateGame(solo, [input()]);
  const soloBoss = solo.enemies.find((enemy) => enemy.kind === 'boss');
  assert.ok(soloBoss);

  const squad = begin(4);
  squad.players.forEach((player) => { player.x = 2000; });
  updateGame(squad, [input(), input(), input(), input()]);
  const squadBoss = squad.enemies.find((enemy) => enemy.kind === 'boss');
  assert.ok(squadBoss);
  assert.ok(squadBoss.maxHp > soloBoss.maxHp * 2);
});

test('four completed sectors reach victory', () => {
  const state = begin(1);
  for (let stage = 0; stage < 4; stage++) {
    if (stage > 0) {
      startStage(state, stage);
      updateGame(state, [input({ start: true })]);
    }
    state.bossDefeated = true;
    updateGame(state, [input()]);
    assert.equal(state.phase, 'stageClear');
    state.phaseTicks = 1;
    updateGame(state, [input()]);
    if (stage < 3) assert.equal(state.stageIndex, stage + 1);
  }
  assert.equal(state.phase, 'victory');
});

test('campaign contains four distinct complete level definitions', () => {
  assert.equal(LEVELS.length, 4);
  assert.deepEqual(LEVELS.map((level) => level.theme), ['jungle', 'base', 'waterfall', 'fortress']);
  assert.equal(LEVELS[2]!.axis, 'vertical');
  for (const level of LEVELS) {
    assert.ok(level.terrain.length >= 15);
    assert.ok(level.enemies.length >= 10);
    assert.ok(level.checkpoints.length >= 2);
    assert.ok(level.boss.baseHp >= 30);
  }
});
