import type { Actions } from "./input";
import { getWorld, sampleHeight, SEA_LEVEL, WORLD_SIZE } from "./world";

export const CRAFT_RADIUS = 1.7;
const MAX_SPEED = 58;
const THRUST_ACCEL = 34;
const DRAG = 0.92;
const YAW_RATE = 1.55;
const LOOK_SENS = 0.00215;
const PITCH_MIN = -1.15;
const PITCH_MAX = 1.15;
const CLIMB_ACCEL = 26;
const VERT_DRAG = 0.88;
const FIXED = 1 / 60;
const MAX_ACCUM = 0.2;

export type Pose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  agl: number;
  msl: number;
  collided: boolean;
};

export type Sim = {
  curr: Pose;
  prev: Pose;
  acc: number;
  impact: number;
};

function makePose(): Pose {
  return {
    x: 0,
    y: 30,
    z: 90,
    yaw: 0,
    pitch: -0.12,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    speed: 0,
    agl: 20,
    msl: 30,
    collided: false,
  };
}

function copyPose(dst: Pose, src: Pose): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.yaw = src.yaw;
  dst.pitch = src.pitch;
  dst.roll = src.roll;
  dst.vx = src.vx;
  dst.vy = src.vy;
  dst.vz = src.vz;
  dst.speed = src.speed;
  dst.agl = src.agl;
  dst.msl = src.msl;
  dst.collided = src.collided;
}

export function createSim(): Sim {
  const world = getWorld();
  const curr = makePose();
  curr.x = world.spawn.x;
  curr.y = world.spawn.y;
  curr.z = world.spawn.z;
  curr.yaw = world.spawn.yaw;
  const prev = makePose();
  copyPose(prev, curr);
  return { curr, prev, acc: 0, impact: 0 };
}

export function forwardFrom(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export function rightFrom(yaw: number): [number, number, number] {
  return [Math.cos(yaw), 0, -Math.sin(yaw)];
}

function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function stepOnce(pose: Pose, actions: Actions, dt: number): void {
  const world = getWorld();

  pose.yaw += actions.yaw * YAW_RATE * dt;
  pose.yaw = wrapPi(pose.yaw);

  const [fx, fy, fz] = forwardFrom(pose.yaw, pose.pitch);
  pose.vx += fx * actions.thrust * THRUST_ACCEL * dt;
  pose.vy += fy * actions.thrust * THRUST_ACCEL * dt;
  pose.vz += fz * actions.thrust * THRUST_ACCEL * dt;
  pose.vy += actions.climb * CLIMB_ACCEL * dt;

  const damp = Math.pow(DRAG, dt * 60);
  const vdamp = Math.pow(VERT_DRAG, dt * 60);
  pose.vx *= damp;
  pose.vz *= damp;
  pose.vy *= vdamp;

  let spd = Math.hypot(pose.vx, pose.vy, pose.vz);
  if (spd > MAX_SPEED) {
    const k = MAX_SPEED / spd;
    pose.vx *= k;
    pose.vy *= k;
    pose.vz *= k;
    spd = MAX_SPEED;
  }

  pose.x += pose.vx * dt;
  pose.y += pose.vy * dt;
  pose.z += pose.vz * dt;

  const half = WORLD_SIZE * 0.48;
  pose.x = Math.max(-half, Math.min(half, pose.x));
  pose.z = Math.max(-half, Math.min(half, pose.z));

  const ground = sampleHeight(world, pose.x, pose.z);
  const minY = Math.max(ground, SEA_LEVEL - 1.2) + CRAFT_RADIUS;
  pose.collided = false;
  if (pose.y < minY) {
    const pen = minY - pose.y;
    pose.y = minY;
    if (pose.vy < 0) pose.vy *= -0.18;
    pose.vy += pen * 8 * dt;
    pose.vx *= 0.72;
    pose.vz *= 0.72;
    pose.collided = true;
  }
  if (pose.y > 92) {
    pose.y = 92;
    if (pose.vy > 0) pose.vy = 0;
  }

  pose.speed = Math.hypot(pose.vx, pose.vy, pose.vz);
  pose.msl = pose.y;
  pose.agl = pose.y - ground;
  const targetRoll = actions.yaw * 0.5 + (-actions.lookDx * LOOK_SENS) * 18;
  pose.roll += (targetRoll - pose.roll) * Math.min(1, 8 * dt);
}

export function stepSim(sim: Sim, actions: Actions, dt: number): void {
  copyPose(sim.prev, sim.curr);
  // Mouse look is a per-frame pixel delta — apply once, not per physics substep.
  sim.curr.yaw -= actions.lookDx * LOOK_SENS;
  sim.curr.pitch -= actions.lookDy * LOOK_SENS;
  if (sim.curr.pitch < PITCH_MIN) sim.curr.pitch = PITCH_MIN;
  if (sim.curr.pitch > PITCH_MAX) sim.curr.pitch = PITCH_MAX;
  sim.curr.yaw = wrapPi(sim.curr.yaw);

  const phys: Actions = { ...actions, lookDx: 0, lookDy: 0 };
  sim.acc += Math.min(dt, MAX_ACCUM);
  let collided = false;
  while (sim.acc >= FIXED) {
    stepOnce(sim.curr, phys, FIXED);
    if (sim.curr.collided) collided = true;
    sim.acc -= FIXED;
  }
  sim.curr.collided = collided;
  if (collided) sim.impact = Math.min(1, sim.impact + 0.45);
  sim.impact = Math.max(0, sim.impact - dt * 1.8);
}

export function interpolatePose(sim: Sim, out: Pose): Pose {
  const a = sim.acc / FIXED;
  const p = sim.prev;
  const c = sim.curr;
  out.x = p.x + (c.x - p.x) * a;
  out.y = p.y + (c.y - p.y) * a;
  out.z = p.z + (c.z - p.z) * a;
  out.yaw = p.yaw + wrapPi(c.yaw - p.yaw) * a;
  out.pitch = p.pitch + (c.pitch - p.pitch) * a;
  out.roll = p.roll + (c.roll - p.roll) * a;
  out.vx = p.vx + (c.vx - p.vx) * a;
  out.vy = p.vy + (c.vy - p.vy) * a;
  out.vz = p.vz + (c.vz - p.vz) * a;
  out.speed = p.speed + (c.speed - p.speed) * a;
  out.agl = p.agl + (c.agl - p.agl) * a;
  out.msl = p.msl + (c.msl - p.msl) * a;
  out.collided = c.collided;
  return out;
}
