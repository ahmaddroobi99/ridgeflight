const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "KeyF",
  "KeyN",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Escape",
]);

const keys = new Set<string>();
let synthetic: string[] | null = null;
let lookDx = 0;
let lookDy = 0;
let stickThrust = 0;
let stickYaw = 0;
let touchClimb = 0;
let prevF = false;
let prevN = false;
let prevEsc = false;

export type Actions = {
  thrust: number;
  yaw: number;
  climb: number;
  lookDx: number;
  lookDy: number;
  toggleWireframe: boolean;
  toggleNight: boolean;
  togglePause: boolean;
};

function sourceHas(code: string): boolean {
  if (synthetic) return synthetic.includes(code);
  return keys.has(code);
}

export function setKeys(codes: string[]): void {
  synthetic = codes;
}

export function addLook(dx: number, dy: number): void {
  lookDx += dx;
  lookDy += dy;
}

export function setStick(thrust: number, yaw: number): void {
  stickThrust = Math.max(-1, Math.min(1, thrust));
  stickYaw = Math.max(-1, Math.min(1, yaw));
}

export function setTouchClimb(v: number): void {
  touchClimb = Math.max(-1, Math.min(1, v));
}

function radialDeadzone(x: number, y: number, dz = 0.18): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function pollGamepad(actions: Actions): void {
  const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
  if (!pads) return;
  for (const pad of pads) {
    if (!pad || pad.mapping !== "standard") continue;
    const ls = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const rs = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 0.12);
    // Left stick X: left is −1 → +yaw (nose left). Y: up is −1 → +thrust.
    actions.yaw += -ls.x;
    actions.thrust += -ls.y;
    actions.lookDx += rs.x * 14;
    actions.lookDy += rs.y * 14;
    const climbUp = pad.buttons[7]?.value ?? 0;
    const climbDn = pad.buttons[6]?.value ?? 0;
    actions.climb += climbUp - climbDn;
    if (pad.buttons[12]?.pressed) actions.climb += 1;
    if (pad.buttons[13]?.pressed) actions.climb -= 1;
    if (pad.buttons[9]?.pressed) actions.togglePause = true;
  }
}

export function sampleActions(): Actions {
  let thrust = 0;
  let yaw = 0;
  let climb = 0;
  if (sourceHas("KeyW") || sourceHas("ArrowUp")) thrust += 1;
  if (sourceHas("KeyS") || sourceHas("ArrowDown")) thrust -= 1;
  if (sourceHas("KeyA") || sourceHas("ArrowLeft")) yaw += 1;
  if (sourceHas("KeyD") || sourceHas("ArrowRight")) yaw -= 1;
  if (sourceHas("Space") || sourceHas("KeyE")) climb += 1;
  if (sourceHas("ShiftLeft") || sourceHas("ShiftRight") || sourceHas("KeyQ") || sourceHas("ControlLeft")) {
    climb -= 1;
  }

  thrust = Math.max(-1, Math.min(1, thrust + stickThrust));
  yaw = Math.max(-1, Math.min(1, yaw + stickYaw));
  climb = Math.max(-1, Math.min(1, climb + touchClimb));

  const f = sourceHas("KeyF");
  const n = sourceHas("KeyN");
  const esc = sourceHas("Escape");
  const toggleWireframe = f && !prevF;
  const toggleNight = n && !prevN;
  const togglePause = esc && !prevEsc;
  prevF = f;
  prevN = n;
  prevEsc = esc;

  const actions: Actions = {
    thrust,
    yaw,
    climb,
    lookDx,
    lookDy,
    toggleWireframe,
    toggleNight,
    togglePause,
  };
  lookDx = 0;
  lookDy = 0;
  pollGamepad(actions);
  actions.thrust = Math.max(-1, Math.min(1, actions.thrust));
  actions.yaw = Math.max(-1, Math.min(1, actions.yaw));
  actions.climb = Math.max(-1, Math.min(1, actions.climb));
  return actions;
}

export function attachInput(target: HTMLElement): () => void {
  const onDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (GAME_CODES.has(e.code)) e.preventDefault();
  };
  const onUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const clear = () => {
    keys.clear();
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });

  const onContext = (e: Event) => e.preventDefault();
  target.addEventListener("contextmenu", onContext);

  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", clear);
    target.removeEventListener("contextmenu", onContext);
    keys.clear();
  };
}
