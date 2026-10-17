/**
 * The play sequence, as a small state machine:
 *
 *   idle → loading → dropping → cueing → spinning ⇄ paused → lifting → idle
 *
 * - play(): (lift off the current record) → load its label → wait for the
 *   sleeve's arrival → drop onto the platter (500ms, slight settle) → cue the
 *   tonearm (lift, swing to the lead-in groove, lower: ~600ms) → spin up
 *   (800ms) to 33⅓ rpm (12in) or 45 rpm (7in).
 * - Commands are queued. A new command arriving mid-sequence makes the running
 *   one finish fast (every remaining step snaps) instead of queueing behind it.
 * - Every animation tweens from the *current* values, so an interrupted
 *   sequence always leaves a consistent scene for the next one.
 */
import { Vector3, type CanvasTexture } from 'three';
import { createDeck, MAT_TOP, PLATTER } from './deck';
import { createRecord, disposeGrooves, radiusOf, type RecordMesh } from './record';
import { createTonearm, playYaw, REST_YAW } from './tonearm';
import { labelFontsReady, labelTexture, type RecordInfo } from './textures';
import { easeIn, easeInOut, easeOut, lerp, linear, settle, Tweens, type Ease } from './tween';
import type { Stage } from './scene';

export type State = 'idle' | 'loading' | 'dropping' | 'cueing' | 'spinning' | 'paused' | 'lifting';

/** Turns per second: 33⅓ rpm (1.8s a turn) and 45 rpm (≈1.33s a turn). */
const SPEED = { '12in': 1 / 1.8, '7in': 1 / 1.333 } as const;
const DROP_HEIGHT = 9;
const LEAD_IN = 0.45; // stylus lands this far inside the record's edge

interface Props {
  yaw?: number;
  lift?: number;
  recY?: number;
  opacity?: number;
  speed?: number;
}

export class Controller {
  state: State = 'idle';
  private tweens = new Tweens();
  private deck = createDeck();
  private arm = createTonearm();
  private record: RecordMesh | null = null;
  private labels = new Map<string, CanvasTexture>();
  private now: Required<Props> = { yaw: REST_YAW, lift: 0, recY: 0, opacity: 0, speed: 0 };
  private paused = false;
  private fast = false;
  private token = 0;
  private busy = false;
  private queue: Promise<void> = Promise.resolve();
  private speedGen = 0;

  constructor(
    private stage: Stage,
    private onState: (state: State) => void,
  ) {
    stage.scene.add(this.deck.group, this.arm.group);
    this.apply({ yaw: REST_YAW, lift: 0 });
  }

  // ---------- frame ----------

  update(now: number, dt: number): void {
    this.tweens.tick(now);
    if (this.now.speed > 0) {
      const turn = this.now.speed * Math.PI * 2 * dt;
      this.deck.spinner.rotation.y -= turn;
      if (this.record) this.record.group.rotation.y -= turn;
    }
  }

  get animating(): boolean {
    return this.tweens.active || this.now.speed > 1e-4;
  }

  // ---------- commands ----------

  play(info: RecordInfo, opts: { instant: boolean; arrival?: Promise<void> }): Promise<void> {
    return this.enqueue((stale) => this.runPlay(info, opts, stale));
  }

  stop({ instant }: { instant: boolean }): Promise<void> {
    return this.enqueue(async (stale) => {
      if (instant) {
        this.reset();
        return;
      }
      await this.liftOff(stale);
    });
  }

  pause(paused: boolean): void {
    this.paused = paused;
    if (!this.record) return;
    const target = SPEED[this.record.info.format];
    if (paused && this.state === 'spinning') {
      this.setState('paused');
      void this.animate(400, easeOut, { speed: 0 });
    } else if (!paused && this.state === 'paused') {
      this.setState('spinning');
      void this.animate(600, easeInOut, { speed: target });
    }
  }

  /** Where the record will appear (screen px): centre and diameter, for the sleeve's flight. */
  dropTarget(): { x: number; y: number; size: number } {
    const centre = new Vector3(PLATTER.x, MAT_TOP + DROP_HEIGHT, PLATTER.z);
    const edge = centre.clone().add(new Vector3(PLATTER.radius, 0, 0));
    const a = this.stage.project(centre);
    const b = this.stage.project(edge);
    return { x: a.x, y: a.y, size: Math.abs(b.x - a.x) * 2 };
  }

  /**
   * Compile every shader the play sequence needs (deck, arm and a stand-in
   * record with the same material setup) so the first drop doesn't stall.
   */
  async warm(): Promise<void> {
    const stand: RecordInfo = {
      slug: '',
      title: '',
      catalogue: '',
      format: '12in',
      ground: '#777777',
      ink: '#ffffff',
      accents: [],
    };
    const label = labelTexture(stand);
    const dummy = createRecord(stand, label);
    dummy.setOpacity(0.5);
    this.stage.scene.add(dummy.group);
    try {
      await this.stage.renderer.compileAsync(this.stage.scene, this.stage.camera);
    } finally {
      this.stage.scene.remove(dummy.group);
      dummy.dispose();
      label.dispose();
    }
    this.stage.kick();
  }

  /** Free the labels of records that aren't on the platter. */
  releaseLabels(): void {
    for (const [slug, texture] of this.labels) {
      if (slug === this.record?.info.slug) continue;
      texture.dispose();
      this.labels.delete(slug);
    }
  }

  dispose(): void {
    this.token++;
    this.tweens.snap();
    this.record?.dispose();
    this.record = null;
    for (const t of this.labels.values()) t.dispose();
    this.labels.clear();
    disposeGrooves();
    this.arm.dispose();
  }

  // ---------- sequence ----------

  private enqueue(job: (stale: () => boolean) => Promise<void>): Promise<void> {
    const token = ++this.token;
    if (this.busy) {
      this.fast = true;
      this.tweens.snap();
    }
    const stale = () => token !== this.token;
    const run = this.queue.then(async () => {
      if (stale()) return;
      this.fast = false;
      this.busy = true;
      try {
        await job(stale);
      } finally {
        if (!stale()) this.busy = false;
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private async runPlay(
    info: RecordInfo,
    { instant, arrival }: { instant: boolean; arrival?: Promise<void> },
    stale: () => boolean,
  ): Promise<void> {
    if (this.record?.info.slug === info.slug) {
      if (instant || this.state === 'spinning' || this.state === 'paused') return;
    }
    if (this.record) await this.liftOff(stale);
    if (stale()) return;

    this.setState('loading');
    const label = await this.label(info);
    if (stale()) return;

    this.deck.setSpeed(info.format);
    const record = createRecord(info, label);
    record.group.position.set(PLATTER.x, MAT_TOP, PLATTER.z);
    this.stage.scene.add(record.group);
    this.record = record;
    const yaw = playYaw(radiusOf(info.format) - LEAD_IN);
    const speed = this.paused ? 0 : SPEED[info.format];

    if (instant) {
      this.apply({ recY: 0, opacity: 1, yaw, lift: 0, speed });
      this.setState(this.paused ? 'paused' : 'spinning');
      this.stage.kick();
      return;
    }

    this.apply({ recY: DROP_HEIGHT, opacity: 0 });
    this.stage.kick();
    if (arrival) await arrival;
    if (stale()) return;

    // Drop: the record fades in above the platter as the sleeve arrives, then settles.
    this.setState('dropping');
    await this.animate(150, linear, { opacity: 1 });
    await this.animate(500, settle, { recY: 0 });
    if (stale()) return;

    // Cue: lift, swing to the lead-in groove, lower.
    this.setState('cueing');
    await this.animate(160, easeOut, { lift: 1 });
    await this.animate(300, easeInOut, { yaw });
    await this.animate(160, easeIn, { lift: 0 });
    if (stale()) return;

    // Spin up.
    if (this.paused) {
      this.setState('paused');
      return;
    }
    this.setState('spinning');
    await this.animate(800, easeInOut, { speed });
  }

  /** Arm back to rest while the record spins down, then lift the record off. */
  private async liftOff(stale: () => boolean): Promise<void> {
    if (!this.record) return;
    this.setState('lifting');
    await Promise.all([
      this.animate(400, easeOut, { speed: 0 }),
      (async () => {
        await this.animate(140, easeOut, { lift: 1 });
        await this.animate(260, easeInOut, { yaw: REST_YAW });
        await this.animate(140, easeIn, { lift: 0 });
      })(),
    ]);
    await this.animate(350, easeIn, { recY: 7, opacity: 0 });
    this.removeRecord();
    if (!stale()) this.setState('idle');
  }

  private reset(): void {
    this.tweens.snap();
    this.removeRecord();
    this.apply({ yaw: REST_YAW, lift: 0, speed: 0 });
    this.setState('idle');
    this.stage.kick();
  }

  private removeRecord(): void {
    if (!this.record) return;
    this.stage.scene.remove(this.record.group);
    this.record.dispose();
    this.record = null;
  }

  private async label(info: RecordInfo): Promise<CanvasTexture> {
    let texture = this.labels.get(info.slug);
    if (!texture) {
      await labelFontsReady();
      texture = labelTexture(info);
      this.labels.set(info.slug, texture);
    }
    return texture;
  }

  // ---------- animation ----------

  private setState(state: State): void {
    this.state = state;
    this.onState(state);
  }

  private apply(props: Props): void {
    Object.assign(this.now, props);
    if (props.yaw !== undefined) this.arm.setYaw(props.yaw);
    if (props.lift !== undefined) this.arm.setLift(props.lift);
    if (this.record) {
      if (props.recY !== undefined) this.record.group.position.y = MAT_TOP + props.recY;
      if (props.opacity !== undefined) this.record.setOpacity(props.opacity);
    }
  }

  /** Tween the given properties from their current values. */
  private animate(ms: number, ease: Ease, to: Props): Promise<void> {
    const from = { ...this.now };
    const gen = to.speed !== undefined ? ++this.speedGen : this.speedGen;
    const keys = Object.keys(to) as (keyof Props)[];
    const done = this.tweens.to(
      this.fast ? 0 : ms,
      (k) => {
        const next: Props = {};
        for (const key of keys) {
          // A newer speed change (e.g. Pause mid spin-up) wins.
          if (key === 'speed' && gen !== this.speedGen) continue;
          next[key] = lerp(from[key], to[key]!, k);
        }
        this.apply(next);
      },
      ease,
    );
    this.stage.kick();
    return done;
  }
}
