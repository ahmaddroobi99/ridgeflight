import { Button } from "@/components/ui/button";

type Props = {
  paused: boolean;
  onStart: () => void;
};

const KEYS = [
  { k: "W / S", v: "Thrust / brake" },
  { k: "A / D", v: "Yaw left / right" },
  { k: "Mouse", v: "Look (pitch & yaw)" },
  { k: "Space / Shift", v: "Climb / descend" },
  { k: "F", v: "Wireframe" },
  { k: "N", v: "Day / night" },
];

export function StartOverlay({ paused, onStart }: Props) {
  return (
    <div
      data-ui
      className="absolute inset-0 z-20 flex items-end justify-center bg-bg/25 p-4 sm:items-center sm:p-8"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface/90 p-5 shadow-lg sm:p-7">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">
          Sector 07 · Aerial survey
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg sm:text-5xl">
          Ridgeflight
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          A low-poly hover-scout over faceted islands. Point with the mouse, push
          thrust with W, and skim the ridges — the hull will not pass the ground.
        </p>

        <ul className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {KEYS.map((row) => (
            <li
              key={row.k}
              className="flex items-baseline justify-between gap-3 rounded-sm bg-bg/50 px-3 py-2"
            >
              <span className="font-medium text-fg">{row.k}</span>
              <span className="text-muted">{row.v}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" onClick={onStart} className="min-w-44">
            {paused ? "Resume flight" : "Start flight"}
          </Button>
          <p className="text-xs text-subtle">
            Click to lock mouse-look. Esc pauses. On a phone, drag to look and
            use the stick for thrust.
          </p>
        </div>
      </div>
    </div>
  );
}
