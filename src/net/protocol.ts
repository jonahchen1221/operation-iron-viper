import { EMPTY_INPUT } from '../core/constants';
import type { InputState } from '../core/types';
import type { GameState } from '../game/state';

export interface LobbyPlayer {
  index: number;
  name: string;
  ready: boolean;
  host: boolean;
  connected: boolean;
}

export type ClientMessage =
  | { t: 'joinLocal'; name: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'input'; seq: number; input: InputState }
  | { t: 'restart' };

export type ServerMessage =
  | { t: 'welcome'; playerIndex: number }
  | { t: 'lobby'; players: LobbyPlayer[]; canStart: boolean; inGame: boolean }
  | { t: 'snapshot'; seq: number; state: GameState; names: string[] }
  | { t: 'error'; code: string; message: string };

export function normalizePlayerName(value: unknown): string {
  if (typeof value !== 'string') return 'ROOKIE';
  const clean = value.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, ' ');
  return (clean || 'ROOKIE').slice(0, 12).toUpperCase();
}

export function sanitizeInput(value: unknown): InputState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const result = { ...EMPTY_INPUT } as InputState;
  for (const key of Object.keys(EMPTY_INPUT) as Array<keyof InputState>) {
    if (typeof raw[key] !== 'boolean') return null;
    result[key] = raw[key] as boolean;
  }
  return result;
}
