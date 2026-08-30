export type Wind = {
  ctx: AudioContext;
  gain: GainNode;
  thud: () => void;
  setSpeed: (speed: number) => void;
  close: () => void;
};

export function createWind(): Wind | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    return {
      ctx,
      gain,
      setSpeed(speed: number) {
        const target = Math.min(0.07, 0.004 + speed * 0.0012);
        gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      },
      thud() {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 90;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        o.stop(ctx.currentTime + 0.2);
      },
      close() {
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}
