/**
 * three.js turntable: the lazily loaded entry point. Never import this module
 * statically; src/components/Turntable/webgl-turntable.ts loads it with a
 * dynamic import() (and prefetches it when the crate is first hovered or focused).
 *
 * Modules: scene.ts (renderer, camera, lights, loop), deck.ts, record.ts,
 * tonearm.ts, textures.ts, tween.ts, controller.ts (the play state machine).
 */
import { Controller, type State } from './controller';
import { createStage } from './scene';
import type { RecordInfo } from './textures';

export type { RecordInfo, State };

export interface TurntableHandle {
  play: (info: RecordInfo, opts: { instant: boolean; arrival?: Promise<void> }) => Promise<void>;
  pause: (paused: boolean) => void;
  stop: (opts: { instant: boolean }) => Promise<void>;
  /** Screen position and size where the record appears, for the sleeve's flight. */
  dropTarget: () => { x: number; y: number; size: number };
  /** Compile the shaders (with a stand-in record) ahead of the first play. */
  warm: () => Promise<void>;
  /** Free cached labels (after the panel closes); the renderer stays for a quick reopen. */
  release: () => void;
  dispose: () => void;
  readonly state: State;
}

/**
 * Build the scene inside `host` (a positioned element; the canvas fills it).
 * `onFail` is called once on any WebGL failure (shader error, lost context,
 * an exception while rendering); the caller swaps back to the CSS turntable.
 */
export function createTurntable(
  host: HTMLElement,
  onFail: (reason: string) => void,
): TurntableHandle {
  let failed = false;
  const fail = (reason: string) => {
    if (failed) return;
    failed = true;
    onFail(reason);
  };
  // `controller` is created right after the stage; the loop callbacks only run on later frames.
  let controller: Controller | undefined;
  const stage = createStage(
    host,
    (now, dt) => controller?.update(now, dt),
    () => controller?.animating ?? false,
    fail,
  );
  controller = new Controller(stage, (state) => {
    host.dataset.state = state;
  });
  host.dataset.state = 'idle';
  stage.kick();
  const c = controller;

  return {
    play: (info, opts) => c.play(info, opts),
    pause: (paused) => c.pause(paused),
    stop: (opts) => c.stop(opts),
    dropTarget: () => c.dropTarget(),
    warm: () => c.warm(),
    release: () => c.releaseLabels(),
    dispose: () => {
      c.dispose();
      stage.dispose();
    },
    get state() {
      return c.state;
    },
  };
}
