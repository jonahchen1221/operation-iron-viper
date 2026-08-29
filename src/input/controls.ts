import { EMPTY_INPUT } from '../core/constants';
import type { InputState } from '../core/types';

const CONTROL_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyL', 'KeyX', 'KeyZ', 'KeyE', 'KeyP',
]);

export class Controls {
  private readonly keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.clear);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  read(): InputState {
    const gamepad = navigator.getGamepads?.()[0] ?? null;
    const axisX = gamepad?.axes[0] ?? 0;
    const axisY = gamepad?.axes[1] ?? 0;
    return {
      left: this.down('ArrowLeft', 'KeyA') || axisX < -0.35 || !!gamepad?.buttons[14]?.pressed,
      right: this.down('ArrowRight', 'KeyD') || axisX > 0.35 || !!gamepad?.buttons[15]?.pressed,
      up: this.down('ArrowUp', 'KeyW') || axisY < -0.4 || !!gamepad?.buttons[12]?.pressed,
      down: this.down('ArrowDown', 'KeyS') || axisY > 0.4 || !!gamepad?.buttons[13]?.pressed,
      fire: this.down('KeyJ', 'KeyX') || !!gamepad?.buttons[2]?.pressed || !!gamepad?.buttons[1]?.pressed,
      jump: this.down('KeyK', 'KeyZ', 'Space') || !!gamepad?.buttons[0]?.pressed,
      interact: this.down('KeyL', 'KeyE') || !!gamepad?.buttons[3]?.pressed,
      start: this.down('Enter') || !!gamepad?.buttons[9]?.pressed,
      pause: this.down('KeyP', 'Escape') || !!gamepad?.buttons[8]?.pressed,
    };
  }

  empty(): InputState {
    return { ...EMPTY_INPUT };
  }

  private down(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (CONTROL_KEYS.has(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (CONTROL_KEYS.has(event.code)) event.preventDefault();
    this.keys.delete(event.code);
  };

  private clear = (): void => this.keys.clear();
}
