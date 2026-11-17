type Cue = "ui" | "place" | "ckm" | "at" | "mortar" | "aa" | "boom" | "leak" | "win" | "lose";

export class Soundboard {
  muted = false;
  private ctx: AudioContext | null = null;
  private last = new Map<string, number>();

  unlock(): void {
    if (typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (!this.muted) this.unlock();
    return this.muted;
  }

  play(cue: Cue): void {
    if (this.muted || typeof window === "undefined") return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (cue === "ckm" || cue === "aa") {
      const prev = this.last.get(cue) ?? -10;
      if (now - prev < (cue === "ckm" ? 0.06 : 0.08)) return;
      this.last.set(cue, now);
    }
    if (cue === "ui") this.blip(ctx, 660, 0.04, 0.04);
    else if (cue === "place") this.blip(ctx, 220, 0.09, 0.06);
    else if (cue === "ckm") this.noise(ctx, 0.05, 1800, 0.05);
    else if (cue === "at") {
      this.noise(ctx, 0.18, 420, 0.12);
      this.blip(ctx, 140, 0.16, 0.07);
    } else if (cue === "mortar") this.noise(ctx, 0.12, 180, 0.1);
    else if (cue === "aa") this.noise(ctx, 0.06, 2400, 0.05);
    else if (cue === "boom") this.noise(ctx, 0.28, 300, 0.14);
    else if (cue === "leak") this.blip(ctx, 90, 0.28, 0.08);
    else if (cue === "win") {
      this.blip(ctx, 392, 0.16, 0.05);
      this.blip(ctx, 523, 0.22, 0.05, 0.12);
    } else if (cue === "lose") this.blip(ctx, 110, 0.4, 0.07);
  }

  private blip(ctx: AudioContext, freq: number, dur: number, gain: number, delay = 0): void {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(ctx: AudioContext, dur: number, cutoff: number, gain: number): void {
    const count = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }
}
