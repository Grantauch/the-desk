/**
 * Synthesised sound. No files are loaded: guns, mines, whistles, machine guns
 * and the engine are built from noise and oscillators in the browser.
 * Nothing starts until the page has had a click, as browsers require.
 */
export class FieldAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; filt: BiquadFilterNode } | null = null;
  private rumble: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  muted = false;

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w;
      d[i] = w * 0.5 + b * 3;
    }
    this.noise = buf;
    this.startRumble();
    this.startEngine();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  private src(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    return s;
  }

  private startRumble() {
    const ctx = this.ctx!;
    const s = this.src(true);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 90;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    s.connect(f).connect(g).connect(this.master!);
    s.start();
    this.rumble = { src: s, gain: g };
  }

  private startEngine() {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 38;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filt).connect(gain).connect(this.master!);
    osc.start();
    this.engine = { osc, gain, filt };
  }

  /** Distant guns: 0 quiet to 1 the final hurricane bombardment. */
  setBarrage(level: number) {
    if (!this.ctx || !this.rumble) return;
    this.rumble.gain.gain.setTargetAtTime(0.35 * level, this.ctx.currentTime, 0.4);
  }

  setEngine(on: boolean, speed: number) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.gain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.3);
    this.engine.osc.frequency.setTargetAtTime(34 + speed * 0.9, t, 0.3);
    this.engine.filt.frequency.setTargetAtTime(260 + speed * 9, t, 0.3);
  }

  /** A shell or mine. size 0.3 small shell, 1 large shell, 4 a mine. dist in metres. */
  boom(size: number, dist: number) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + Math.min(1.2, dist / 900);
    const att = Math.max(0.04, 1 / (1 + dist / 120));
    const s = this.src();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(size > 2 ? 900 : 1800 * att + 200, t);
    f.frequency.exponentialRampToValueAtTime(size > 2 ? 40 : 120, t + 0.6 + size * 0.5);
    const g = ctx.createGain();
    const peak = Math.min(1.4, 0.5 * size * att + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7 + size * 1.1);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t);
    s.stop(t + 1 + size * 1.4);
    if (size > 2) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(52, t);
      o.frequency.exponentialRampToValueAtTime(24, t + 3);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.9 * att + 0.2, t + 0.05);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      o.connect(og).connect(this.master!);
      o.start(t);
      o.stop(t + 3.6);
    }
  }

  /** Officers' whistles along the line at zero hour. */
  whistles() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    for (let i = 0; i < 9; i++) {
      const t = ctx.currentTime + 0.1 + i * 0.22 + Math.random() * 0.25;
      const o = ctx.createOscillator();
      o.type = "sine";
      const base = 2300 + Math.random() * 500;
      o.frequency.setValueAtTime(base, t);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 28 + Math.random() * 10;
      const lg = ctx.createGain();
      lg.gain.value = 90;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      const vol = 0.05 / (1 + i * 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(this.master!);
      o.start(t);
      lfo.start(t);
      o.stop(t + 1.3);
      lfo.stop(t + 1.3);
    }
  }

  /** A short machine gun burst at a distance. */
  burst(dist: number) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const att = Math.max(0.03, 1 / (1 + dist / 90));
    const t0 = ctx.currentTime + Math.min(0.8, dist / 900);
    const n = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.105;
      const s = this.src();
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 700 + Math.random() * 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32 * att, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      s.connect(f).connect(g).connect(this.master!);
      s.start(t);
      s.stop(t + 0.09);
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
