/**
 * Renderer, camera, lighting and the render loop.
 *
 * - Transparent canvas (the deck sits on the page's paper), sRGB output,
 *   ACES Filmic tone mapping, DPR capped at 2, sized by a ResizeObserver.
 * - RoomEnvironment through PMREM for soft reflections, one warm directional
 *   light with filtered (PCF) shadows (1024 map, blurred with shadow.radius) and a ShadowMaterial catcher. No bloom,
 *   no post-processing.
 * - Renders on demand: the loop runs only while `isAnimating()` says so, and
 *   stops when the canvas is off-screen or the tab is hidden.
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** Ask for frames (call whenever something starts moving). */
  kick: () => void;
  setVisible: (visible: boolean) => void;
  project: (p: Vector3) => { x: number; y: number };
  dispose: () => void;
}

export function createStage(
  host: HTMLElement,
  tick: (now: number, dt: number) => void,
  isAnimating: () => boolean,
  onError: (reason: string) => void,
): Stage {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.debug.onShaderError = () => onError('shader error');

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    onError('webglcontextlost');
  });
  host.append(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // Framed like the mockup: deck centred, tonearm on the right, headroom above for the drop.
  const camera = new PerspectiveCamera(30, 1, 1, 400);
  const target = new Vector3(0, 12, -1);
  camera.position.set(0, 72, 92);
  camera.lookAt(target);

  const sun = new DirectionalLight(0xffe4c4, 2.1);
  sun.position.set(-22, 48, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -38;
  sc.right = 38;
  sc.top = 38;
  sc.bottom = -38;
  sc.near = 5;
  sc.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  const catcher = new Mesh(new PlaneGeometry(160, 160), new ShadowMaterial({ opacity: 0.2 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // ---------- size ----------

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the whole deck in frame whatever the aspect ratio.
    camera.zoom = Math.min(1, camera.aspect / 1.02);
    camera.updateProjectionMatrix();
    kick();
  };
  const resizer = new ResizeObserver(resize);
  resizer.observe(host);

  // ---------- loop ----------

  let raf = 0;
  let last = 0;
  let onScreen = true;
  const visible = () => onScreen && !document.hidden;

  const frame = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    try {
      tick(now, dt);
      renderer.render(scene, camera);
    } catch (error) {
      onError(String(error));
      return;
    }
    if (visible() && isAnimating()) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  function kick() {
    if (!raf && visible()) raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    if (onScreen) kick();
  });
  io.observe(host);
  const onVisibility = () => {
    if (visible()) kick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const project = (p: Vector3) => {
    const v = p.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  };

  resize();

  return {
    renderer,
    scene,
    camera,
    kick,
    setVisible: (v) => {
      onScreen = v;
      if (v) kick();
    },
    project,
    dispose: () => {
      cancelAnimationFrame(raf);
      resizer.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const materials = mesh.material ? ([] as unknown[]).concat(mesh.material) : [];
        for (const material of materials as {
          dispose: () => void;
          map?: { dispose: () => void } | null;
        }[]) {
          material.map?.dispose();
          material.dispose();
        }
      });
      envTarget.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
