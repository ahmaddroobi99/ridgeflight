import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWind, type Wind } from "@/game/audio";
import { installControlsTest } from "@/game/controls-test";
import { sampleActions } from "@/game/input";
import {
  createSim,
  forwardFrom,
  interpolatePose,
  stepSim,
  type Pose,
  type Sim,
} from "@/game/sim";
import { createTerrainGeometry } from "@/game/terrain-geometry";
import type { Telemetry } from "@/game/telemetry";
import { getWorld, sampleHeight, WORLD_SIZE, type World } from "@/game/world";

type SceneProps = {
  playing: boolean;
  night: boolean;
  wireframe: boolean;
  onTelemetry: (t: Telemetry) => void;
  onToggleWireframe: () => void;
  onToggleNight: () => void;
  onPause: () => void;
};

const CRAFT_AGL_TOUCH = 2.4;
const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dummy = new THREE.Object3D();
const _renderPose: Pose = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  speed: 0,
  agl: 0,
  msl: 0,
  collided: false,
};

const DAY_BG = new THREE.Color("#8ebad4");
const NIGHT_BG = new THREE.Color("#070b14");
const DAY_FOG = new THREE.Color("#b7d2e2");
const NIGHT_FOG = new THREE.Color("#0b121c");
const _bg = new THREE.Color();
const _fogCol = new THREE.Color();

function Terrain({ world, wireframe }: { world: World; wireframe: boolean }) {
  const geo = useMemo(() => createTerrainGeometry(world), [world]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.94,
        metalness: 0.02,
        envMapIntensity: 0.2,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useEffect(() => {
    mat.wireframe = wireframe;
  }, [mat, wireframe]);

  return <mesh geometry={geo} material={mat} />;
}

function Water({ night }: { night: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <circleGeometry args={[WORLD_SIZE * 0.72, 64]} />
      <meshStandardMaterial
        color={night ? "#163844" : "#2a6d78"}
        roughness={0.18}
        metalness={0.35}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

function Forest({ world, wireframe }: { world: World; wireframe: boolean }) {
  const trunk = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.16, 0.22, 1.15, 5);
    g.translate(0, 0.55, 0);
    return g;
  }, []);
  const crown = useMemo(() => {
    const g = new THREE.ConeGeometry(0.78, 1.7, 6);
    g.translate(0, 1.55, 0);
    return g;
  }, []);
  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(0.7, 0), []);
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#4a3428", flatShading: true, roughness: 1 }),
    [],
  );
  const crownMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2f5a34", flatShading: true, roughness: 0.9 }),
    [],
  );
  const rockMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#6a6762", flatShading: true, roughness: 0.95 }),
    [],
  );
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const t = trunkRef.current;
    const c = crownRef.current;
    if (t && c) {
      world.trees.forEach((tree, i) => {
        _dummy.position.set(tree.x, tree.y, tree.z);
        _dummy.rotation.set(0, tree.r ?? 0, 0);
        _dummy.scale.setScalar(tree.s ?? 1);
        _dummy.updateMatrix();
        t.setMatrixAt(i, _dummy.matrix);
        c.setMatrixAt(i, _dummy.matrix);
      });
      t.instanceMatrix.needsUpdate = true;
      c.instanceMatrix.needsUpdate = true;
    }
    const r = rockRef.current;
    if (r) {
      world.rocks.forEach((rock, i) => {
        _dummy.position.set(rock.x, rock.y + 0.2, rock.z);
        _dummy.rotation.set(0.2, rock.r ?? 0, 0.15);
        _dummy.scale.setScalar(rock.s ?? 1);
        _dummy.updateMatrix();
        r.setMatrixAt(i, _dummy.matrix);
      });
      r.instanceMatrix.needsUpdate = true;
    }
  }, [world]);

  useEffect(() => {
    trunkMat.wireframe = wireframe;
    crownMat.wireframe = wireframe;
    rockMat.wireframe = wireframe;
  }, [wireframe, trunkMat, crownMat, rockMat]);

  useEffect(() => {
    return () => {
      trunk.dispose();
      crown.dispose();
      rockGeo.dispose();
      trunkMat.dispose();
      crownMat.dispose();
      rockMat.dispose();
    };
  }, [trunk, crown, rockGeo, trunkMat, crownMat, rockMat]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunk, trunkMat, world.trees.length]} />
      <instancedMesh ref={crownRef} args={[crown, crownMat, world.trees.length]} />
      <instancedMesh ref={rockRef} args={[rockGeo, rockMat, world.rocks.length]} />
    </>
  );
}

function Beacons({ world }: { world: World }) {
  return (
    <group>
      {world.beacons.map((b, i) => (
        <group key={i} position={[b.x, b.y + 1.6, b.z]}>
          <mesh>
            <boxGeometry args={[0.28, 3.2, 0.28]} />
            <meshStandardMaterial color="#d9e2e8" roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.85, 0]}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color="#7fafc2"
              emissive="#7fafc2"
              emissiveIntensity={0.85}
              roughness={0.25}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Clouds({ world, night }: { world: World; night: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#eef4f7",
        flatShading: true,
        transparent: true,
        opacity: 0.78,
        roughness: 1,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    world.clouds.forEach((c, i) => {
      _dummy.position.set(c.x, c.y, c.z);
      _dummy.rotation.set(0.1, c.r ?? 0, 0.05);
      _dummy.scale.set((c.s ?? 10) * 1.6, (c.s ?? 10) * 0.45, (c.s ?? 10) * 1.1);
      _dummy.updateMatrix();
      m.setMatrixAt(i, _dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [world]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    m.rotation.y += dt * 0.012;
  });

  useEffect(() => {
    mat.color.set(night ? "#9aa7b4" : "#eef4f7");
    mat.opacity = night ? 0.28 : 0.78;
  }, [night, mat]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  return <instancedMesh ref={mesh} args={[geo, mat, world.clouds.length]} />;
}

function Starfield({ night }: { night: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 650;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 200 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.min(1, Math.random() * 0.92));
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) + 8;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!night) return null;
  return (
    <points geometry={geo}>
      <pointsMaterial color="#e4eef6" size={1.35} sizeAttenuation={false} depthWrite={false} />
    </points>
  );
}

function Craft({ poseRef }: { poseRef: RefObject<Pose> }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    const p = poseRef.current;
    if (!g || !p) return;
    g.position.set(p.x, p.y, p.z);
    const [fx, fy, fz] = forwardFrom(p.yaw, p.pitch);
    g.lookAt(p.x + fx, p.y + fy, p.z + fz);
    g.rotateZ(p.roll);
  });

  const body = "#6ea3b5";
  const ink = "#1b242b";
  const paper = "#e8ecef";

  return (
    <group ref={group}>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.5, 0.34, 2.35]} />
        <meshStandardMaterial color={body} roughness={0.4} metalness={0.12} flatShading />
      </mesh>
      <mesh position={[0, 0, 1.38]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.26, 0.62, 5]} />
        <meshStandardMaterial color={paper} roughness={0.35} flatShading />
      </mesh>
      <mesh position={[0, -0.04, 0.15]}>
        <boxGeometry args={[3.35, 0.07, 0.92]} />
        <meshStandardMaterial color={ink} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[1.1, 0.02, -0.15]} rotation={[0, 0.12, 0.08]}>
        <boxGeometry args={[1.1, 0.05, 0.42]} />
        <meshStandardMaterial color={ink} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[-1.1, 0.02, -0.15]} rotation={[0, -0.12, -0.08]}>
        <boxGeometry args={[1.1, 0.05, 0.42]} />
        <meshStandardMaterial color={ink} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[0, 0.4, -0.98]}>
        <boxGeometry args={[0.07, 0.72, 0.42]} />
        <meshStandardMaterial color={paper} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0.42]}>
        <boxGeometry args={[0.3, 0.16, 0.48]} />
        <meshStandardMaterial color="#9ec4d4" roughness={0.15} metalness={0.35} />
      </mesh>
      <mesh position={[0, -0.02, -1.28]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.5, 4]} />
        <meshStandardMaterial
          color="#cfe4ee"
          emissive="#7fafc2"
          emissiveIntensity={0.4}
          roughness={0.3}
        />
      </mesh>
      <pointLight position={[0, 0.1, 1.6]} color="#d7eef6" intensity={0.55} distance={18} />
    </group>
  );
}

function Lights({ night }: { night: boolean }) {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const t = useRef(night ? 1 : 0);
  const fog = useMemo(() => new THREE.FogExp2(0xb7d2e2, 0.0034), []);

  useEffect(() => {
    scene.fog = fog;
    scene.background = _bg;
  }, [scene, fog]);

  useFrame((_, dt) => {
    const target = night ? 1 : 0;
    t.current += (target - t.current) * (1 - Math.exp(-2.8 * dt));
    const k = t.current;
    _bg.copy(DAY_BG).lerp(NIGHT_BG, k);
    _fogCol.copy(DAY_FOG).lerp(NIGHT_FOG, k);
    fog.color.copy(_fogCol);
    fog.density = 0.0032 + k * 0.0036;
    if (sun.current) {
      sun.current.intensity = 1.15 - k * 0.95;
      sun.current.color.set(k > 0.5 ? "#c5d4e8" : "#fff1d0");
      sun.current.position.set(80 - k * 140, 120 - k * 30, 40 - k * 90);
    }
    if (hemi.current) {
      hemi.current.intensity = 0.62 - k * 0.28;
      hemi.current.color.set(k > 0.5 ? "#1a2840" : "#cfe4f2");
      hemi.current.groundColor.set(k > 0.5 ? "#0c1412" : "#5a6e48");
    }
    if (amb.current) amb.current.intensity = 0.22 - k * 0.08;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.22} />
      <hemisphereLight ref={hemi} args={["#cfe4f2", "#5a6e48", 0.62]} />
      <directionalLight
        ref={sun}
        position={[80, 120, 40]}
        intensity={1.15}
      />
    </>
  );
}

function CameraRig({
  sim,
  poseRef,
  playing,
  world,
}: {
  sim: Sim;
  poseRef: RefObject<Pose>;
  playing: boolean;
  world: World;
}) {
  const snap = useRef(true);
  useEffect(() => {
    snap.current = true;
  }, [playing]);

  useFrame((state, dt) => {
    const cam = state.camera;
    if (!playing) {
      const reduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t = state.clock.elapsedTime * (reduced ? 0.02 : 0.085);
      const r = 168;
      cam.position.set(Math.sin(t) * r, 52, Math.cos(t) * r);
      cam.lookAt(4, 10, -8);
      return;
    }

    const p = poseRef.current;
    if (!p) return;
    const [fx, fy, fz] = forwardFrom(p.yaw, p.pitch);
    _fwd.set(fx, fy, fz);
    _pos.set(p.x, p.y, p.z);
    _desired.copy(_pos).addScaledVector(_fwd, -8.6).addScaledVector(_up, 2.55);
    const gh = sampleHeight(world, _desired.x, _desired.z);
    if (_desired.y < gh + 2.2) _desired.y = gh + 2.2;
    const k = snap.current ? 1 : 1 - Math.exp(-5.4 * dt);
    cam.position.lerp(_desired, k);
    const shake = sim.impact * sim.impact;
    if (shake > 0.002) {
      const time = state.clock.elapsedTime * 28;
      cam.position.x += Math.sin(time * 1.7) * shake * 0.42;
      cam.position.y += Math.cos(time * 1.3) * shake * 0.28;
    }
    _look.copy(_pos).addScaledVector(_fwd, 5.5);
    cam.lookAt(_look);
    snap.current = false;
  });
  return null;
}

function SunMoon({ night }: { night: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const tx = night ? -72 : 96;
    const ty = night ? 78 : 118;
    const tz = night ? -48 : 52;
    mesh.position.x += (tx - mesh.position.x) * (1 - Math.exp(-3 * dt));
    mesh.position.y += (ty - mesh.position.y) * (1 - Math.exp(-3 * dt));
    mesh.position.z += (tz - mesh.position.z) * (1 - Math.exp(-3 * dt));
  });
  return (
    <mesh ref={ref} position={[96, 118, 52]}>
      <sphereGeometry args={[night ? 5.5 : 7, 12, 12]} />
      <meshBasicMaterial color={night ? "#d5deea" : "#f3e2b0"} />
    </mesh>
  );
}

function Loop({
  playing,
  night,
  wireframe,
  onTelemetry,
  onToggleWireframe,
  onToggleNight,
  onPause,
}: SceneProps) {
  const world = useMemo(() => getWorld(), []);
  const sim = useMemo(() => createSim(), []);
  const poseRef = useRef<Pose>(sim.curr);
  const hudAcc = useRef(0);
  const wind = useRef<Wind | null>(null);
  const lastHit = useRef(false);

  useEffect(() => installControlsTest(sim), [sim]);

  useEffect(() => {
    if (!playing) {
      wind.current?.close();
      wind.current = null;
      return;
    }
    const w = createWind();
    wind.current = w;
    void w?.ctx.resume();
    return () => {
      w?.close();
      if (wind.current === w) wind.current = null;
    };
  }, [playing]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (playing) {
      const actions = sampleActions();
      if (actions.toggleWireframe) onToggleWireframe();
      if (actions.toggleNight) onToggleNight();
      if (actions.togglePause) onPause();
      stepSim(sim, actions, dt);
      interpolatePose(sim, _renderPose);
      poseRef.current = _renderPose;
      wind.current?.setSpeed(_renderPose.speed);
      if (_renderPose.collided && !lastHit.current) wind.current?.thud();
      lastHit.current = _renderPose.collided;
    }
    hudAcc.current += dt;
    if (hudAcc.current > 0.08) {
      hudAcc.current = 0;
      const p = sim.curr;
      const heading = ((-p.yaw * 180) / Math.PI + 360) % 360;
      onTelemetry({
        altitude: p.agl,
        msl: p.msl,
        speed: p.speed,
        heading,
        grounded: p.collided || p.agl < CRAFT_AGL_TOUCH,
      });
    }
  });

  return (
    <>
      <Lights night={night} />
      <Starfield night={night} />
      <SunMoon night={night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -14, 0]}>
        <planeGeometry args={[1800, 1800]} />
        <meshBasicMaterial color="#070b10" />
      </mesh>
      <CameraRig sim={sim} poseRef={poseRef} playing={playing} world={world} />
      <Terrain world={world} wireframe={wireframe} />
      <Water night={night} />
      <Forest world={world} wireframe={wireframe} />
      <Beacons world={world} />
      <Clouds world={world} night={night} />
      <Craft poseRef={poseRef} />
    </>
  );
}

export function GameScene(props: SceneProps) {
  return (
    <Canvas
      className="h-full w-full touch-none"
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      camera={{ fov: 62, near: 0.35, far: 860, position: [140, 55, 140] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0a0c0e");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.98;
      }}
    >
      <Loop {...props} />
    </Canvas>
  );
}
