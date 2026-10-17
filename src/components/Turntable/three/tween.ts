/**
 * Tiny tween helper (no dependencies). Tweens are advanced by the render loop
 * via tick(now); each resolves its promise when it ends. snap() finishes every
 * running tween at once (used when the visitor plays another record mid-sequence).
 */

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOut: Ease = (t) => 1 - (1 - t) ** 3;
export const easeIn: Ease = (t) => t ** 3;
export const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Ease-out with a small overshoot: the record settles onto the platter. */
export const settle: Ease = (t) => {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

interface Running {
  start: number;
  duration: number;
  ease: Ease;
  update: (k: number) => void;
  resolve: () => void;
}

export class Tweens {
  private running: Running[] = [];

  /** Calls update(eased 0→1) for `duration` ms. A duration of 0 completes immediately. */
  to(duration: number, update: (k: number) => void, ease: Ease = easeOut): Promise<void> {
    return new Promise((resolve) => {
      if (duration <= 0) {
        update(1);
        resolve();
        return;
      }
      update(0);
      this.running.push({ start: -1, duration, ease, update, resolve });
    });
  }

  tick(now: number): void {
    for (const t of [...this.running]) {
      if (t.start < 0) t.start = now;
      const p = Math.min(1, (now - t.start) / t.duration);
      t.update(t.ease(p));
      if (p >= 1) {
        this.running.splice(this.running.indexOf(t), 1);
        t.resolve();
      }
    }
  }

  /** Jump every running tween to its end. */
  snap(): void {
    const all = this.running;
    this.running = [];
    for (const t of all) {
      t.update(1);
      t.resolve();
    }
  }

  get active(): boolean {
    return this.running.length > 0;
  }
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
