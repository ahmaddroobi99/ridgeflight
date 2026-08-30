import { setKeys } from "./input";
import type { Sim } from "./sim";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export function installControlsTest(sim: Sim): () => void {
  window.__controlsTest = {
    getYaw: () => sim.curr.yaw,
    getSpeed: () => sim.curr.speed,
    setKeys,
  };
  return () => {
    if (window.__controlsTest) delete window.__controlsTest;
  };
}
