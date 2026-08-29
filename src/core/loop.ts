import { TICK_RATE } from './constants';

export class FixedLoop {
  private accumulator = 0;
  private previous = 0;
  private frame = 0;
  private running = false;

  constructor(
    private readonly update: () => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.frame = requestAnimationFrame(this.step);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private step = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(250, now - this.previous);
    this.previous = now;
    this.accumulator += dt;
    const tickMs = 1000 / TICK_RATE;
    let safety = 0;
    while (this.accumulator >= tickMs && safety++ < 8) {
      this.update();
      this.accumulator -= tickMs;
    }
    this.render(this.accumulator / tickMs);
    this.frame = requestAnimationFrame(this.step);
  };
}
