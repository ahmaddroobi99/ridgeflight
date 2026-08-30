import { useRef, type PointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { setStick, setTouchClimb } from "@/game/input";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
};

export function TouchControls({ enabled }: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);

  if (!enabled) return null;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const max = 42;
    const len = Math.hypot(dx, dy);
    const scale = len > max ? max / len : 1;
    const kx = dx * scale;
    const ky = dy * scale;
    if (knob.current) {
      knob.current.style.transform = `translate(${kx}px, ${ky}px)`;
    }
    // up = thrust, left = +yaw
    setStick(-ky / max, -kx / max);
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    origin.current = null;
    setStick(0, 0);
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      data-ui
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-4 sm:hidden"
    >
      <div
        className="pointer-events-auto relative size-28 rounded-full border border-border-strong bg-surface/70"
        onPointerDown={onDown}
        onPointerMove={move}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          ref={knob}
          className="absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/80"
        />
      </div>
      <div className="pointer-events-auto flex flex-col gap-2">
        <ClimbButton dir={1} label="Climb" />
        <ClimbButton dir={-1} label="Descend" />
      </div>
    </div>
  );
}

function ClimbButton({ dir, label }: { dir: number; label: string }) {
  const hold = (v: number) => () => setTouchClimb(v);
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-12 items-center justify-center rounded-md border border-border-strong bg-surface/80 text-fg",
      )}
      onPointerDown={hold(dir)}
      onPointerUp={hold(0)}
      onPointerCancel={hold(0)}
      onPointerLeave={hold(0)}
    >
      {dir > 0 ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
    </button>
  );
}
