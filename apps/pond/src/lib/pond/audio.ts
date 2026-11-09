/** Procedural toy sounds. Unlock on the first gesture. */

export class PondAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private fireFilter: BiquadFilterNode | null = null;
  private lastPaint = 0;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.buildFireBed();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.03);
    }
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private buildFireBed() {
    if (!this.ctx || !this.master) return;
    const seconds = 1.5;
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.93 + white * 0.07;
      data[i] = last;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.fireFilter = filter;
    this.fireGain = gain;
  }

  setFireLevel(amount: number) {
    if (!this.ctx || !this.fireGain || !this.fireFilter) return;
    const t = this.ctx.currentTime;
    const a = Math.min(1, amount / 280);
    this.fireGain.gain.setTargetAtTime(a * 0.18, t, 0.12);
    this.fireFilter.frequency.setTargetAtTime(280 + a * 420, t, 0.2);
  }

  paint(element: number, xNorm: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPaint < 0.055) return;
    this.lastPaint = now;
    const pan = Math.max(-0.85, Math.min(0.85, xNorm * 2 - 1));

    if (element === 3 || element === 20) {
      this.blip(420 + Math.random() * 180, 0.05, 0.045, pan, "sine");
      this.noise(0.04, 0.03, 1400, pan);
    } else if (element === 16 || element === 8) {
      this.noise(0.08, 0.05, 500, pan);
    } else if (element === 19) {
      this.blip(880 + Math.random() * 240, 0.07, 0.05, pan, "triangle");
    } else if (element === 13 || element === 12) {
      this.blip(260 + Math.random() * 80, 0.06, 0.04, pan, "sine");
    } else {
      this.noise(0.05, 0.035, 900 + Math.random() * 400, pan);
    }
  }

  boom() {
    if (!this.ctx || !this.master || this.muted) return;
    this.noise(0.28, 0.22, 180, 0);
    this.blip(70, 0.22, 0.18, 0, "sine");
  }

  shake() {
    if (!this.ctx || !this.master || this.muted) return;
    this.noise(0.16, 0.1, 240, 0);
  }

  pop(kind: "sprout" | "freeze" | "birth") {
    if (!this.ctx || !this.master || this.muted) return;
    const f = kind === "freeze" ? 980 : kind === "birth" ? 620 : 540;
    this.blip(f, 0.08, 0.05, 0, "triangle");
  }

  private blip(freq: number, dur: number, vol: number, pan: number, type: OscillatorType) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g);
    g.connect(p);
    p.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      p.disconnect();
    };
  }

  private noise(dur: number, vol: number, cutoff: number, pan: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(filter);
    filter.connect(g);
    g.connect(p);
    p.connect(this.master);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      p.disconnect();
    };
  }
}

export const pondAudio = new PondAudio();
