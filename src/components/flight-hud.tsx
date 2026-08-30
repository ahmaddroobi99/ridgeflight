import { Grid3x3, Moon, Pause, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Telemetry } from "@/game/telemetry";

type Props = {
  telemetry: Telemetry;
  night: boolean;
  wireframe: boolean;
  onToggleNight: () => void;
  onToggleWireframe: () => void;
  onPause: () => void;
};

function padHeading(deg: number): string {
  return Math.round((deg + 360) % 360)
    .toString()
    .padStart(3, "0");
}

export function FlightHud({
  telemetry,
  night,
  wireframe,
  onToggleNight,
  onToggleWireframe,
  onPause,
}: Props) {
  const low = telemetry.altitude < 6;
  return (
    <div data-ui className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-none flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-2.5 sm:px-4">
          <div className="flex gap-5">
            <Stat
              label="Alt AGL"
              value={`${Math.max(0, telemetry.altitude).toFixed(0)}`}
              unit="m"
              warn={low}
            />
            <Stat label="MSL" value={telemetry.msl.toFixed(0)} unit="m" />
            <Stat label="Spd" value={telemetry.speed.toFixed(0)} unit="m/s" />
            <Stat label="Hdg" value={padHeading(telemetry.heading)} unit="°" />
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={night ? "Switch to day" : "Switch to night"}
            onClick={onToggleNight}
          >
            {night ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant={wireframe ? "default" : "outline"}
            size="icon"
            aria-label="Toggle wireframe"
            onClick={onToggleWireframe}
          >
            <Grid3x3 className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Pause" onClick={onPause}>
            <Pause className="size-4" />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:block">
        <p className="rounded-md border border-border bg-surface/70 px-3 py-1.5 text-xs text-muted">
          W thrust · A/D yaw · mouse look · F wire · N night
        </p>
      </div>

      {low ? (
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2">
          <p className="rounded-md border border-danger/40 bg-bg/70 px-3 py-1 text-xs font-medium tracking-widest text-danger uppercase">
            Terrain
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  warn,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "font-mono text-lg font-medium tabular-nums leading-none sm:text-xl",
          warn ? "text-warn" : "text-fg",
        )}
      >
        {value}
        <span className="ml-1 text-xs font-normal text-subtle">{unit}</span>
      </p>
    </div>
  );
}
