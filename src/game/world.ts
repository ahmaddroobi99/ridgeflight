import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { hashSeed, mulberry32 } from "./rng";

export const WORLD_SIZE = 480;
export const WORLD_SEGMENTS = 100;
export const SEA_LEVEL = 0;
export const WORLD_SEED = "ridgeflight-sector-07";

export type Vec3 = { x: number; y: number; z: number; s?: number; r?: number };

export type World = {
  size: number;
  segments: number;
  heights: Float32Array;
  trees: Vec3[];
  rocks: Vec3[];
  beacons: Vec3[];
  clouds: Vec3[];
  spawn: { x: number; y: number; z: number; yaw: number };
  elevNoise: NoiseFunction2D;
  moistNoise: NoiseFunction2D;
};

function fbm(noise: NoiseFunction2D, x: number, z: number, octaves: number): number {
  let v = 0;
  let a = 1;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, z * f);
    sum += a;
    a *= 0.5;
    f *= 2.07;
  }
  return v / sum;
}

function islandMask(x: number, z: number, cx: number, cz: number, r: number): number {
  const d = Math.hypot(x - cx, z - cz) / r;
  if (d >= 1) return 0;
  const e = 1 - d;
  return e * e * (3 - 2 * e);
}

function heightAtCoords(
  elev: NoiseFunction2D,
  x: number,
  z: number,
): number {
  let n = (fbm(elev, x * 0.00315, z * 0.00315, 5) + 1) * 0.5;
  n = Math.pow(Math.max(0, n), 1.32);

  const ridge = Math.pow(1 - Math.abs(fbm(elev, x * 0.0058 + 18, z * 0.0058, 4)), 2.1);

  let e = n * 0.7 + ridge * 0.42;

  const mask =
    islandMask(x, z, 8, -6, 178) * 1 +
    islandMask(x, z, 158, -78, 74) * 0.72 +
    islandMask(x, z, -136, 118, 62) * 0.68 +
    islandMask(x, z, 48, 156, 46) * 0.5 +
    islandMask(x, z, -90, -150, 40) * 0.42;

  e *= Math.min(1.2, mask);
  e += 0.26 * islandMask(x, z, 12, -28, 78) * Math.pow(n, 1.7);

  return e * 64 - 7.5;
}

export function createWorld(seedLabel = WORLD_SEED): World {
  const seed = hashSeed(seedLabel);
  const elev = createNoise2D(mulberry32(seed));
  const moist = createNoise2D(mulberry32(seed ^ 0x9e3779b9));
  const placeRng = mulberry32(seed ^ 0x85ebca6b);

  const segments = WORLD_SEGMENTS;
  const verts = segments + 1;
  const size = WORLD_SIZE;
  const heights = new Float32Array(verts * verts);
  const half = size / 2;
  const step = size / segments;

  for (let j = 0; j < verts; j++) {
    const z = -half + j * step;
    for (let i = 0; i < verts; i++) {
      const x = -half + i * step;
      heights[j * verts + i] = heightAtCoords(elev, x, z);
    }
  }

  const world: World = {
    size,
    segments,
    heights,
    trees: [],
    rocks: [],
    beacons: [],
    clouds: [],
    spawn: { x: 0, y: 28, z: 92, yaw: 0 },
    elevNoise: elev,
    moistNoise: moist,
  };

  const trees: Vec3[] = [];
  const rocks: Vec3[] = [];
  const beacons: Vec3[] = [];

  for (let j = 3; j < segments - 3; j += 2) {
    for (let i = 3; i < segments - 3; i += 2) {
      const x = -half + i * step;
      const z = -half + j * step;
      const y = heights[j * verts + i]!;
      const yL = heights[j * verts + (i - 1)]!;
      const yR = heights[j * verts + (i + 1)]!;
      const yD = heights[(j - 1) * verts + i]!;
      const yU = heights[(j + 1) * verts + i]!;
      const slope = Math.hypot(yR - yL, yU - yD) / (step * 2);

      if (y > 2.4 && y < 17 && slope < 0.38 && placeRng() < 0.16) {
        trees.push({
          x: x + (placeRng() - 0.5) * step,
          y,
          z: z + (placeRng() - 0.5) * step,
          s: 0.75 + placeRng() * 0.7,
          r: placeRng() * Math.PI * 2,
        });
      } else if (y > 8 && y < 34 && slope > 0.55 && placeRng() < 0.1) {
        rocks.push({
          x,
          y,
          z,
          s: 0.5 + placeRng() * 1.1,
          r: placeRng() * Math.PI * 2,
        });
      }
    }
  }

  if (trees.length > 240) trees.length = 240;
  if (rocks.length > 90) rocks.length = 90;

  for (let j = 4; j < segments - 4; j += 3) {
    for (let i = 4; i < segments - 4; i += 3) {
      const y = heights[j * verts + i]!;
      if (y < 32) continue;
      let peak = true;
      for (let dj = -1; dj <= 1 && peak; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          if (heights[(j + dj) * verts + (i + di)]! >= y) {
            peak = false;
            break;
          }
        }
      }
      if (peak) {
        const x = -half + i * step;
        const z = -half + j * step;
        beacons.push({ x, y, z, s: 1, r: 0 });
      }
    }
  }
  if (beacons.length > 7) beacons.length = 7;

  const clouds: Vec3[] = [];
  for (let c = 0; c < 18; c++) {
    const ang = placeRng() * Math.PI * 2;
    const rad = 40 + placeRng() * 160;
    clouds.push({
      x: Math.cos(ang) * rad,
      y: 38 + placeRng() * 22,
      z: Math.sin(ang) * rad,
      s: 8 + placeRng() * 14,
      r: placeRng() * Math.PI * 2,
    });
  }

  let spawn = { x: 0, y: 28, z: 96, yaw: 0 };
  let found = false;
  for (let j = segments - 8; j > segments * 0.55 && !found; j--) {
    for (let i = Math.floor(segments * 0.35); i < segments * 0.65; i++) {
      const y = heights[j * verts + i]!;
      if (y > 2.5 && y < 11) {
        spawn = {
          x: -half + i * step,
          y: y + 20,
          z: -half + j * step,
          yaw: 0,
        };
        found = true;
        break;
      }
    }
  }
  if (!found) {
    const y = sampleHeight(world, 0, 100);
    spawn = { x: 0, y: y + 22, z: 100, yaw: 0 };
  }

  world.trees = trees;
  world.rocks = rocks;
  world.beacons = beacons;
  world.clouds = clouds;
  world.spawn = spawn;
  return world;
}

export function sampleHeight(world: World, x: number, z: number): number {
  const { size, segments, heights } = world;
  const verts = segments + 1;
  const half = size / 2;
  const u = ((x + half) / size) * segments;
  const v = ((z + half) / size) * segments;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const ic = Math.max(0, Math.min(segments, i));
  const jc = Math.max(0, Math.min(segments, j));
  const in1 = Math.max(0, Math.min(segments, ic + 1));
  const jn1 = Math.max(0, Math.min(segments, jc + 1));
  const fu = Math.min(1, Math.max(0, u - i));
  const fv = Math.min(1, Math.max(0, v - j));
  const h00 = heights[jc * verts + ic]!;
  const h10 = heights[jc * verts + in1]!;
  const h01 = heights[jn1 * verts + ic]!;
  const h11 = heights[jn1 * verts + in1]!;
  return h00 * (1 - fu) * (1 - fv) + h10 * fu * (1 - fv) + h01 * (1 - fu) * fv + h11 * fu * fv;
}

export function sampleSlope(world: World, x: number, z: number): number {
  const d = 1.6;
  const dx = sampleHeight(world, x + d, z) - sampleHeight(world, x - d, z);
  const dz = sampleHeight(world, x, z + d) - sampleHeight(world, x, z - d);
  return Math.hypot(dx, dz) / (d * 2);
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const COL = {
  deep: [0.07, 0.22, 0.28] as [number, number, number],
  shallow: [0.16, 0.45, 0.48] as [number, number, number],
  sand: [0.82, 0.74, 0.55] as [number, number, number],
  grass: [0.38, 0.58, 0.3] as [number, number, number],
  meadow: [0.5, 0.62, 0.32] as [number, number, number],
  pine: [0.22, 0.4, 0.27] as [number, number, number],
  rock: [0.45, 0.44, 0.42] as [number, number, number],
  slate: [0.36, 0.38, 0.4] as [number, number, number],
  snow: [0.92, 0.94, 0.96] as [number, number, number],
};

export function colorAt(
  world: World,
  x: number,
  y: number,
  z: number,
  slope: number,
): [number, number, number] {
  const moist = (fbm(world.moistNoise, x * 0.0075, z * 0.0075, 3) + 1) * 0.5;
  let c: [number, number, number];
  if (y < -1.4) c = mix(COL.deep, COL.shallow, (y + 6) / 5);
  else if (y < 1.4) c = mix(COL.shallow, COL.sand, (y + 1.4) / 2.8);
  else if (y < 3.4) c = mix(COL.sand, moist > 0.45 ? COL.grass : COL.meadow, (y - 1.4) / 2);
  else if (y < 14) c = mix(moist > 0.5 ? COL.pine : COL.grass, COL.meadow, moist);
  else if (y < 24) c = mix(COL.pine, COL.rock, (y - 14) / 10);
  else if (y < 36) c = mix(COL.rock, COL.slate, (y - 24) / 12);
  else c = mix(COL.slate, COL.snow, Math.min(1, (y - 36) / 10));

  if (slope > 0.55 && y > 4 && y < 38) {
    c = mix(c, COL.rock, Math.min(1, (slope - 0.55) / 0.5));
  }
  return c;
}

let cached: World | null = null;

export function getWorld(): World {
  if (!cached) cached = createWorld();
  return cached;
}
