/**
 * The deck, built from primitives (units ≈ cm): a satin charcoal plinth, a
 * brushed-metal platter with a dark mat, a shiny spindle and the printed
 * speed decal. No brand names or logos.
 */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  MeshBasicMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { speedDecal } from './textures';

export const PLINTH = { width: 46, height: 4, depth: 36 };
/** Platter centre on the plinth (x, z) and the height of its mat's top surface. */
export const PLATTER = { x: -6, z: 0, radius: 15.5, height: 1.6 };
export const MAT_TOP = PLINTH.height + PLATTER.height + 0.15;

export function createDeck() {
  const group = new Group();

  const plinth = new Mesh(
    new RoundedBoxGeometry(PLINTH.width, PLINTH.height, PLINTH.depth, 4, 1.1),
    new MeshStandardMaterial({ color: 0x2b2724, roughness: 0.55, metalness: 0.08 }),
  );
  plinth.position.y = PLINTH.height / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Everything that turns with the record lives in `spinner`.
  const spinner = new Group();
  spinner.position.set(PLATTER.x, PLINTH.height, PLATTER.z);
  group.add(spinner);

  const platter = new Mesh(
    new CylinderGeometry(PLATTER.radius, PLATTER.radius, PLATTER.height, 128),
    new MeshStandardMaterial({ color: 0xb8b4ad, metalness: 0.9, roughness: 0.35 }),
  );
  platter.position.y = PLATTER.height / 2;
  platter.castShadow = true;
  platter.receiveShadow = true;
  spinner.add(platter);

  const mat = new Mesh(
    new CylinderGeometry(PLATTER.radius - 0.3, PLATTER.radius - 0.3, 0.15, 96),
    new MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.95, metalness: 0 }),
  );
  mat.position.y = PLATTER.height + 0.075;
  mat.receiveShadow = true;
  spinner.add(mat);

  const spindle = new Mesh(
    new CylinderGeometry(0.32, 0.32, 1.1, 24),
    new MeshStandardMaterial({ color: 0xd8d4cd, metalness: 1, roughness: 0.15 }),
  );
  spindle.position.set(PLATTER.x, MAT_TOP + 0.55, PLATTER.z);
  group.add(spindle);

  const decal = speedDecal();
  const label = new Mesh(
    new PlaneGeometry(12, 3),
    new MeshBasicMaterial({ map: decal.texture, transparent: true, toneMapped: false }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(-PLINTH.width / 2 + 8, PLINTH.height + 0.01, PLINTH.depth / 2 - 2.2);
  group.add(label);

  return { group, spinner, setSpeed: decal.set };
}
