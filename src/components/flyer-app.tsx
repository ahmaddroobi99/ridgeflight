import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { addLook, attachInput } from "@/game/input";
import { FlightHud } from "@/components/flight-hud";
import { StartOverlay } from "@/components/start-overlay";
import { TouchControls } from "@/components/touch-controls";
import type { Telemetry } from "@/game/telemetry";

type SceneComp = (props: {
  playing: boolean;
  night: boolean;
  wireframe: boolean;
  onTelemetry: (t: Telemetry) => void;
  onToggleWireframe: () => void;
  onToggleNight: () => void;
  onPause: () => void;
}) => JSX.Element;

const ZERO: Telemetry = {
  altitude: 0,
  msl: 0,
  speed: 0,
  heading: 0,
  grounded: false,
};

function loadSettings(): { night: boolean; wireframe: boolean } {
  try {
    const raw = localStorage.getItem("ridgeflight-settings");
    if (!raw) return { night: false, wireframe: false };
    const parsed = JSON.parse(raw) as { night?: boolean; wireframe?: boolean };
    return { night: !!parsed.night, wireframe: !!parsed.wireframe };
  } catch {
    return { night: false, wireframe: false };
  }
}

export function FlyerApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [Scene, setScene] = useState<SceneComp | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry>(ZERO);
  const [isCoarse, setIsCoarse] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setNight(s.night);
    setWireframe(s.wireframe);
    void import("@/components/game-scene").then((m) => setScene(() => m.GameScene));
    setIsCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    return attachInput(el);
  }, [Scene]);

  useEffect(() => {
    try {
      localStorage.setItem("ridgeflight-settings", JSON.stringify({ night, wireframe }));
    } catch {
      /* ignore quota */
    }
  }, [night, wireframe]);

  const toggleNight = useCallback(() => setNight((v) => !v), []);
  const toggleWireframe = useCallback(() => setWireframe((v) => !v), []);
  const pause = useCallback(() => {
    setPlaying(false);
    setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  const start = useCallback(() => {
    setPlaying(true);
    setPaused(false);
    rootRef.current?.focus();
    const el = rootRef.current;
    if (el && !window.matchMedia("(pointer: coarse)").matches) {
      void el.requestPointerLock?.();
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!playing) return;
      if (document.pointerLockElement) addLook(e.movementX, e.movementY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [playing]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!playing) return;
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!playing || document.pointerLockElement) return;
    if (!dragging.current) return;
    addLook(e.movementX, e.movementY);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const overlay = !playing;

  return (
    <main
      ref={rootRef}
      tabIndex={0}
      className="relative h-dvh min-h-svh w-full touch-none overflow-hidden bg-bg text-fg outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {Scene ? (
        <div className="absolute inset-0">
          <Scene
            playing={playing}
            night={night}
            wireframe={wireframe}
            onTelemetry={setTelemetry}
            onToggleNight={toggleNight}
            onToggleWireframe={toggleWireframe}
            onPause={pause}
          />
        </div>
      ) : null}

      {playing ? (
        <FlightHud
          telemetry={telemetry}
          night={night}
          wireframe={wireframe}
          onToggleNight={toggleNight}
          onToggleWireframe={toggleWireframe}
          onPause={pause}
        />
      ) : null}

      <TouchControls enabled={playing && isCoarse} />

      {overlay ? <StartOverlay paused={paused} onStart={start} /> : null}
    </main>
  );
}
