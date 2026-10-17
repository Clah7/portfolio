/**
 * The tonearm: a Group that turns (yaw) around its base and tilts (lift) to
 * raise the stylus. Base, post, arm tube, headshell and counterweight, in
 * brushed metal and black.
 *
 * Angles: yaw θ points the arm along (cos θ, 0, -sin θ) in world x/z.
 * Rest: parallel to the plinth's side, off the record, on its rest post.
 * Play: the stylus on the record's lead-in groove, solved from the pivot's
 * distance to the platter centre (law of cosines), so it lands on the groove
 * for either record size and never sweeps into the platter.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { MAT_TOP, PLATTER, PLINTH } from './deck';

const PIVOT = { x: 16, z: -11 };
const LENGTH = 23; // pivot → stylus
const ARM_Y = MAT_TOP + 1.25;
export const LIFT = 0.07; // radians: stylus raised ~1.6 above the record
export const REST_YAW = -Math.PI / 2;

/** Yaw that puts the stylus at `radius` from the platter centre. */
export function playYaw(radius: number): number {
  const dx = PLATTER.x - PIVOT.x;
  const dz = PLATTER.z - PIVOT.z;
  const d = Math.hypot(dx, dz);
  const cos = (LENGTH ** 2 + d ** 2 - radius ** 2) / (2 * LENGTH * d);
  const phi = Math.acos(Math.max(-1, Math.min(1, cos)));
  const toCentre = Math.atan2(-dz, dx);
  // Of the two solutions, take the one on the rest side (no sweep across the record).
  const a = toCentre + phi;
  const b = toCentre - phi;
  const norm = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
  return Math.abs(norm(a - REST_YAW)) < Math.abs(norm(b - REST_YAW)) ? a : b;
}

export function createTonearm() {
  const metal = new MeshStandardMaterial({ color: 0xcfcbc4, metalness: 0.9, roughness: 0.3 });
  const black = new MeshStandardMaterial({ color: 0x151312, metalness: 0.3, roughness: 0.5 });

  const root = new Group();
  root.position.set(PIVOT.x, PLINTH.height, PIVOT.z);

  const base = new Mesh(new CylinderGeometry(2.4, 2.6, 0.9, 48), black);
  base.position.y = 0.45;
  const post = new Mesh(new CylinderGeometry(0.55, 0.55, ARM_Y - PLINTH.height, 24), metal);
  post.position.y = (ARM_Y - PLINTH.height) / 2;
  root.add(base, post);

  // Rest post for the arm, beside the platter.
  const rest = new Mesh(new CylinderGeometry(0.3, 0.3, ARM_Y - PLINTH.height - 0.3, 16), metal);
  rest.position.set(0, (ARM_Y - PLINTH.height - 0.3) / 2, LENGTH - 6.5);
  root.add(rest);

  const yaw = new Group();
  yaw.position.y = ARM_Y - PLINTH.height;
  root.add(yaw);
  const lift = new Group();
  yaw.add(lift);

  const tube = new Mesh(new CylinderGeometry(0.22, 0.22, LENGTH - 1.5, 16), metal);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = (LENGTH - 1.5) / 2;
  const headshell = new Mesh(new BoxGeometry(3, 0.35, 1.5), black);
  headshell.position.set(LENGTH - 0.6, 0, 0);
  const cartridge = new Mesh(new BoxGeometry(1.4, 0.95, 0.9), black);
  cartridge.position.set(LENGTH - 0.2, -0.62, 0);
  const counterweight = new Mesh(new CylinderGeometry(1.15, 1.15, 2.6, 32), metal);
  counterweight.rotation.z = Math.PI / 2;
  counterweight.position.x = -3.6;
  const pivotCap = new Mesh(new CylinderGeometry(0.9, 0.9, 0.9, 24), black);
  lift.add(tube, headshell, cartridge, counterweight, pivotCap);

  for (const m of [base, post, rest, tube, headshell, cartridge, counterweight, pivotCap]) {
    m.castShadow = true;
  }

  return {
    group: root,
    /** Turn the arm (radians, see the module comment). */
    setYaw: (θ: number) => (yaw.rotation.y = θ),
    /** 0 = stylus down; 1 = lifted. */
    setLift: (k: number) => (lift.rotation.z = LIFT * k),
    get yaw() {
      return yaw.rotation.y;
    },
    dispose: () => {
      for (const m of [base, post, rest, tube, headshell, cartridge, counterweight, pivotCap]) {
        m.geometry.dispose();
      }
      metal.dispose();
      black.dispose();
    },
  };
}
