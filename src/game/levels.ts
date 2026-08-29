import type { BossKind, EnemyKind, PickupKind, Rect, StageAxis, ThemeKind, Vec2 } from '../core/types';

export interface TerrainRect extends Rect {
  kind: 'ground' | 'platform' | 'wall' | 'bridge';
}

export interface HazardRect extends Rect {
  kind: 'water' | 'spikes' | 'laser';
}

export interface EnemySpawn {
  id: number;
  x: number;
  y: number;
  kind: Exclude<EnemyKind, 'boss'>;
  trigger: number;
  drop?: PickupKind;
}

export interface Checkpoint {
  progress: number;
  x: number;
  y: number;
}

export interface BossSpec {
  kind: BossKind;
  x: number;
  y: number;
  trigger: number;
  baseHp: number;
  name: string;
}

export interface LevelDef {
  index: number;
  title: string;
  subtitle: string;
  operation: string;
  axis: StageAxis;
  theme: ThemeKind;
  width: number;
  height: number;
  spawn: Vec2;
  terrain: TerrainRect[];
  hazards: HazardRect[];
  enemies: EnemySpawn[];
  checkpoints: Checkpoint[];
  boss: BossSpec;
}

const ground = (x: number, y: number, w: number, h: number): TerrainRect => ({ x, y, w, h, kind: 'ground' });
const platform = (x: number, y: number, w: number, h = 8): TerrainRect => ({ x, y, w, h, kind: 'platform' });
const wall = (x: number, y: number, w: number, h: number): TerrainRect => ({ x, y, w, h, kind: 'wall' });
const bridge = (x: number, y: number, w: number, h = 8): TerrainRect => ({ x, y, w, h, kind: 'bridge' });

function spawns(rows: Array<Omit<EnemySpawn, 'id'>>): EnemySpawn[] {
  return rows.map((row, id) => ({ ...row, id }));
}

const jungle: LevelDef = {
  index: 0,
  title: 'THE VERDANT LINE',
  subtitle: 'Break the jungle perimeter',
  operation: '01 / GREEN KNIFE',
  axis: 'horizontal',
  theme: 'jungle',
  width: 2320,
  height: 216,
  spawn: { x: 36, y: 158 },
  terrain: [
    ground(0, 184, 474, 32), ground(532, 184, 426, 32), ground(1016, 184, 352, 32),
    ground(1398, 184, 922, 32), bridge(466, 168, 76), bridge(950, 170, 76),
    platform(180, 144, 84), platform(326, 120, 96), platform(610, 140, 96), platform(768, 112, 80),
    platform(1086, 132, 96), platform(1250, 104, 72), platform(1502, 140, 104),
    platform(1690, 112, 76), platform(1840, 146, 88), wall(1980, 146, 16, 38),
  ],
  hazards: [
    { x: 474, y: 198, w: 58, h: 18, kind: 'water' },
    { x: 958, y: 204, w: 58, h: 12, kind: 'water' },
    { x: 1368, y: 202, w: 30, h: 14, kind: 'water' },
  ],
  enemies: spawns([
    { x: 300, y: 94, kind: 'rifleman', trigger: 100 },
    { x: 430, y: 158, kind: 'runner', trigger: 180 },
    { x: 650, y: 114, kind: 'rifleman', trigger: 420, drop: 'machine' },
    { x: 780, y: 86, kind: 'sniper', trigger: 520 },
    { x: 900, y: 154, kind: 'runner', trigger: 610 },
    { x: 1100, y: 106, kind: 'rifleman', trigger: 820 },
    { x: 1190, y: 40, kind: 'flyer', trigger: 890, drop: 'spread' },
    { x: 1320, y: 78, kind: 'sniper', trigger: 1040 },
    { x: 1500, y: 114, kind: 'runner', trigger: 1220 },
    { x: 1610, y: 154, kind: 'rifleman', trigger: 1310 },
    { x: 1760, y: 60, kind: 'flyer', trigger: 1460, drop: 'barrier' },
    { x: 1860, y: 120, kind: 'turret', trigger: 1560 },
    { x: 1940, y: 154, kind: 'rifleman', trigger: 1660 },
  ]),
  checkpoints: [
    { progress: 720, x: 650, y: 112 },
    { progress: 1420, x: 1460, y: 158 },
  ],
  boss: { kind: 'wallCannon', name: 'WAR-EYE GATE', x: 2182, y: 120, trigger: 1840, baseHp: 30 },
};

const base: LevelDef = {
  index: 1,
  title: 'THE STEEL MAZE',
  subtitle: 'Cut power to the foundry',
  operation: '02 / DEAD CIRCUIT',
  axis: 'horizontal',
  theme: 'base',
  width: 2520,
  height: 216,
  spawn: { x: 34, y: 158 },
  terrain: [
    ground(0, 184, 2520, 32), wall(260, 146, 18, 38), wall(510, 146, 18, 38),
    wall(836, 146, 18, 38), wall(1210, 146, 18, 38), wall(1572, 146, 18, 38),
    platform(92, 142, 110), platform(320, 110, 128), platform(566, 144, 122),
    platform(694, 106, 92), platform(890, 136, 164), platform(1062, 98, 98),
    platform(1260, 134, 128), platform(1438, 100, 92), platform(1624, 142, 126),
    platform(1770, 108, 110), platform(1914, 142, 108), platform(2050, 112, 96),
    wall(2200, 146, 18, 38), platform(2260, 144, 112),
  ],
  hazards: [
    { x: 456, y: 176, w: 54, h: 8, kind: 'laser' },
    { x: 786, y: 176, w: 50, h: 8, kind: 'laser' },
    { x: 1388, y: 176, w: 50, h: 8, kind: 'laser' },
    { x: 1882, y: 176, w: 32, h: 8, kind: 'laser' },
  ],
  enemies: spawns([
    { x: 240, y: 92, kind: 'turret', trigger: 70 },
    { x: 390, y: 84, kind: 'sniper', trigger: 160 },
    { x: 540, y: 154, kind: 'runner', trigger: 280 },
    { x: 680, y: 118, kind: 'rifleman', trigger: 390, drop: 'laser' },
    { x: 820, y: 92, kind: 'turret', trigger: 510 },
    { x: 990, y: 110, kind: 'sniper', trigger: 690 },
    { x: 1120, y: 72, kind: 'flyer', trigger: 790 },
    { x: 1250, y: 108, kind: 'rifleman', trigger: 910 },
    { x: 1430, y: 154, kind: 'runner', trigger: 1070, drop: 'barrier' },
    { x: 1540, y: 68, kind: 'flyer', trigger: 1190 },
    { x: 1690, y: 116, kind: 'sniper', trigger: 1350 },
    { x: 1800, y: 82, kind: 'turret', trigger: 1460 },
    { x: 1980, y: 116, kind: 'rifleman', trigger: 1610, drop: 'life' },
    { x: 2100, y: 84, kind: 'sniper', trigger: 1750 },
  ]),
  checkpoints: [
    { progress: 800, x: 870, y: 158 },
    { progress: 1640, x: 1620, y: 116 },
  ],
  boss: { kind: 'reactor', name: 'FURNACE HEART', x: 2390, y: 116, trigger: 2070, baseHp: 42 },
};

const waterfallPlatforms: TerrainRect[] = [
  ground(0, 1452, 384, 28), platform(24, 1404, 176), platform(172, 1360, 184),
  platform(52, 1316, 178), platform(184, 1272, 176), platform(84, 1228, 176),
  platform(18, 1184, 180), platform(160, 1140, 184), platform(196, 1096, 164),
  platform(92, 1052, 184), platform(18, 1008, 174), platform(158, 964, 190),
  platform(86, 920, 184), platform(190, 876, 170), platform(52, 832, 190),
  platform(164, 788, 180), platform(18, 744, 180), platform(132, 700, 190),
  platform(190, 656, 174), platform(76, 612, 190), platform(18, 568, 180),
  platform(156, 524, 190), platform(200, 480, 164), platform(86, 436, 186),
  platform(18, 392, 180), platform(154, 348, 192), platform(72, 304, 190),
  platform(188, 260, 172), platform(112, 216, 184), platform(0, 172, 384, 24),
];

const waterfall: LevelDef = {
  index: 2,
  title: 'ASCENT OF THUNDER',
  subtitle: 'Climb above the kill zone',
  operation: '03 / HIGH WATER',
  axis: 'vertical',
  theme: 'waterfall',
  width: 384,
  height: 1480,
  spawn: { x: 48, y: 1426 },
  terrain: waterfallPlatforms,
  hazards: [
    { x: 0, y: 1468, w: 384, h: 12, kind: 'water' },
    { x: 152, y: 1418, w: 44, h: 10, kind: 'water' },
    { x: 306, y: 978, w: 50, h: 8, kind: 'spikes' },
    { x: 132, y: 626, w: 48, h: 8, kind: 'spikes' },
  ],
  enemies: spawns([
    { x: 238, y: 1332, kind: 'rifleman', trigger: 80 },
    { x: 92, y: 1288, kind: 'runner', trigger: 150 },
    { x: 270, y: 1120, kind: 'sniper', trigger: 250, drop: 'spread' },
    { x: 80, y: 984, kind: 'rifleman', trigger: 360 },
    { x: 250, y: 884, kind: 'flyer', trigger: 470 },
    { x: 42, y: 720, kind: 'turret', trigger: 600, drop: 'barrier' },
    { x: 258, y: 632, kind: 'runner', trigger: 700 },
    { x: 90, y: 548, kind: 'sniper', trigger: 790 },
    { x: 276, y: 412, kind: 'flyer', trigger: 900, drop: 'machine' },
    { x: 58, y: 366, kind: 'rifleman', trigger: 990 },
    { x: 264, y: 236, kind: 'turret', trigger: 1100 },
  ]),
  checkpoints: [
    { progress: 470, x: 62, y: 982 },
    { progress: 910, x: 208, y: 498 },
  ],
  boss: { kind: 'skySerpent', name: 'STORM SERPENT', x: 286, y: 118, trigger: 1210, baseHp: 50 },
};

const fortress: LevelDef = {
  index: 3,
  title: 'IRON VIPER',
  subtitle: 'End the invasion tonight',
  operation: '04 / BLACK SUN',
  axis: 'horizontal',
  theme: 'fortress',
  width: 2780,
  height: 216,
  spawn: { x: 34, y: 158 },
  terrain: [
    ground(0, 184, 720, 32), ground(780, 184, 622, 32), ground(1462, 184, 1318, 32),
    bridge(708, 164, 84), bridge(1390, 166, 84), wall(342, 146, 18, 38),
    wall(960, 146, 18, 38), wall(1720, 146, 18, 38), wall(2130, 146, 18, 38),
    platform(120, 140, 112), platform(392, 112, 106), platform(544, 142, 112),
    platform(820, 126, 102), platform(1010, 138, 122), platform(1186, 102, 118),
    platform(1494, 138, 122), platform(1640, 96, 72), platform(1780, 140, 126),
    platform(1960, 110, 122), platform(2180, 140, 116), platform(2340, 104, 98),
  ],
  hazards: [
    { x: 720, y: 198, w: 60, h: 18, kind: 'spikes' },
    { x: 1402, y: 198, w: 60, h: 18, kind: 'spikes' },
    { x: 1320, y: 176, w: 70, h: 8, kind: 'laser' },
    { x: 2308, y: 176, w: 46, h: 8, kind: 'laser' },
  ],
  enemies: spawns([
    { x: 270, y: 154, kind: 'runner', trigger: 70 },
    { x: 390, y: 86, kind: 'sniper', trigger: 150 },
    { x: 570, y: 116, kind: 'turret', trigger: 310, drop: 'laser' },
    { x: 720, y: 62, kind: 'flyer', trigger: 430 },
    { x: 870, y: 100, kind: 'rifleman', trigger: 570 },
    { x: 1000, y: 68, kind: 'sniper', trigger: 700 },
    { x: 1160, y: 154, kind: 'runner', trigger: 820, drop: 'life' },
    { x: 1320, y: 66, kind: 'flyer', trigger: 950 },
    { x: 1510, y: 112, kind: 'rifleman', trigger: 1110 },
    { x: 1690, y: 70, kind: 'turret', trigger: 1260, drop: 'barrier' },
    { x: 1840, y: 114, kind: 'sniper', trigger: 1420 },
    { x: 1980, y: 82, kind: 'rifleman', trigger: 1570 },
    { x: 2140, y: 62, kind: 'flyer', trigger: 1720, drop: 'spread' },
    { x: 2310, y: 78, kind: 'turret', trigger: 1900 },
    { x: 2420, y: 154, kind: 'runner', trigger: 2050 },
  ]),
  checkpoints: [
    { progress: 860, x: 820, y: 100 },
    { progress: 1760, x: 1790, y: 114 },
  ],
  boss: { kind: 'ironViper', name: 'GENERAL VIPER', x: 2640, y: 116, trigger: 2340, baseHp: 68 },
};

export const LEVELS: readonly LevelDef[] = [jungle, base, waterfall, fortress];

export function getLevel(index: number): LevelDef {
  const level = LEVELS[index];
  if (!level) throw new Error(`Unknown level ${index}`);
  return level;
}

export function stageProgress(level: LevelDef, x: number, y: number): number {
  return level.axis === 'horizontal' ? x : level.height - y;
}
