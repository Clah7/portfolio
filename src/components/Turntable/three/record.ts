/**
 * A record: a thin disc with canvas-drawn grooves (colour + roughness, so the
 * light catches them as it turns) and a printed label from the record's cover.
 * 12in records are full size; 7in are 58% of the diameter.
 */
import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type CanvasTexture,
} from 'three';
import { grooveTextures, type RecordInfo } from './textures';

export const RADIUS_12 = 15;
export const RADIUS_7 = RADIUS_12 * 0.58;
const THICKNESS = 0.18;
const LABEL = { '12in': 0.33, '7in': 0.42 } as const;

export const radiusOf = (format: RecordInfo['format']) => (format === '7in' ? RADIUS_7 : RADIUS_12);

/** Shared groove textures per format (kept for the scene's lifetime). */
const grooves = new Map<RecordInfo['format'], ReturnType<typeof grooveTextures>>();

export interface RecordMesh {
  group: Group;
  info: RecordInfo;
  setOpacity: (o: number) => void;
  dispose: () => void;
}

export function createRecord(info: RecordInfo, label: CanvasTexture): RecordMesh {
  const radius = radiusOf(info.format);
  const labelFraction = LABEL[info.format];
  if (!grooves.has(info.format)) grooves.set(info.format, grooveTextures(labelFraction));
  const { map, roughnessMap } = grooves.get(info.format)!;

  const vinyl = new MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 1,
    metalness: 0.15,
    transparent: true,
  });
  const edge = new MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.4, transparent: true });
  const disc = new Mesh(new CylinderGeometry(radius, radius, THICKNESS, 96), [edge, vinyl, edge]);
  disc.position.y = THICKNESS / 2;
  disc.castShadow = true;
  disc.receiveShadow = true;

  const labelMaterial = new MeshStandardMaterial({
    map: label,
    roughness: 0.65,
    metalness: 0,
    transparent: true,
  });
  const labelMesh = new Mesh(new CircleGeometry(radius * labelFraction, 64), labelMaterial);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.y = THICKNESS + 0.004;

  const group = new Group();
  group.add(disc, labelMesh);

  const materials = [vinyl, edge, labelMaterial];
  return {
    group,
    info,
    setOpacity: (o) => {
      for (const m of materials) {
        m.opacity = o;
        m.depthWrite = o > 0.99;
      }
      group.visible = o > 0.001;
    },
    dispose: () => {
      disc.geometry.dispose();
      labelMesh.geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

export function disposeGrooves(): void {
  for (const { map, roughnessMap } of grooves.values()) {
    map.dispose();
    roughnessMap.dispose();
  }
  grooves.clear();
}
