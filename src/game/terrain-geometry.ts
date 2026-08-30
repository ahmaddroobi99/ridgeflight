import * as THREE from "three";
import { colorAt, type World } from "./world";

export function createTerrainGeometry(world: World): THREE.BufferGeometry {
  const { size, segments, heights } = world;
  const verts = segments + 1;
  const half = size / 2;
  const step = size / segments;
  const indexed = new THREE.BufferGeometry();
  const pos = new Float32Array(verts * verts * 3);

  for (let j = 0; j < verts; j++) {
    const z = -half + j * step;
    for (let i = 0; i < verts; i++) {
      const x = -half + i * step;
      const k = (j * verts + i) * 3;
      pos[k] = x;
      pos[k + 1] = heights[j * verts + i]!;
      pos[k + 2] = z;
    }
  }

  const idx = new Uint32Array(segments * segments * 6);
  let t = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      idx[t++] = a;
      idx[t++] = c;
      idx[t++] = b;
      idx[t++] = b;
      idx[t++] = c;
      idx[t++] = d;
    }
  }

  indexed.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  indexed.setIndex(new THREE.BufferAttribute(idx, 1));
  const geo = indexed.toNonIndexed();
  indexed.dispose();

  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const ax = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  for (let i = 0; i < p.count; i += 3) {
    ax.set(p.getX(i), p.getY(i), p.getZ(i));
    e1.set(p.getX(i + 1) - ax.x, p.getY(i + 1) - ax.y, p.getZ(i + 1) - ax.z);
    e2.set(p.getX(i + 2) - ax.x, p.getY(i + 2) - ax.y, p.getZ(i + 2) - ax.z);
    nrm.copy(e1).cross(e2);
    const slope = 1 - Math.abs(nrm.normalize().y);
    const yAvg = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const xAvg = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const zAvg = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const [r, g, b] = colorAt(world, xAvg, yAvg, zAvg, slope);
    for (let k = 0; k < 3; k++) {
      const o = (i + k) * 3;
      colors[o] = r;
      colors[o + 1] = g;
      colors[o + 2] = b;
    }
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
