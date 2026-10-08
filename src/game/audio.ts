/* Procedural WebAudio sound engine — no external assets, APK friendly. */

type Ctx = AudioContext;

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicNodes: AudioNode[] = [];
  sfxOn = true;
  musicOn = false;
  private lastBall = 0;
  private lastCushion = 0;

  init() {
    if (this.ctx) return;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);

      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.init();
    if (!this.ctx || !this.musicGain) return;
    if (on) {
      if (this.musicNodes.length) return;
      const ctx = this.ctx;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 520;
      filt.Q.value = 0.6;
      filt.connect(this.musicGain);
      const freqs = [55, 82.4, 110, 164.8];
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? "triangle" : "sine";
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 6;
        const g = ctx.createGain();
        g.gain.value = 0.16 / (i + 1);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.045 + i * 0.017;
        const lg = ctx.createGain();
        lg.gain.value = 0.09 / (i + 1);
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(filt);
        o.start();
        lfo.start();
        this.musicNodes.push(o, lfo, g);
      });
      this.musicNodes.push(filt);
      this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 2.5);
    } else {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
      const nodes = this.musicNodes;
      this.musicNodes = [];
      setTimeout(() => {
        nodes.forEach((n) => {
          const o = n as OscillatorNode;
          if (o.stop) try { o.stop(); } catch { /* noop */ }
          try { n.disconnect(); } catch { /* noop */ }
        });
      }, 1800);
    }
  }

  private get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseSrc() {
    if (!this.ctx || !this.noise) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  /* --- individual voices ---------------------------------------- */

  private tone(freq: number, dur: number, gain: number, type: OscillatorType, detune = 0, delay = 0) {
    if (!this.ctx || !this.master || !this.sfxOn) return;
    const t0 = this.t + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private burst(freq: number, q: number, dur: number, gain: number, delay = 0, type: BiquadFilterType = "bandpass") {
    if (!this.ctx || !this.master || !this.sfxOn) return;
    const s = this.noiseSrc();
    if (!s) return;
    const t0 = this.t + delay;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }

  /** ball on ball clack. v = impact speed in/s */
  ball(v: number) {
    if (!this.sfxOn) return;
    const now = performance.now();
    if (now - this.lastBall < 22) return;
    this.lastBall = now;
    const a = Math.min(1, v / 320);
    if (a < 0.02) return;
    this.tone(1180 + a * 620, 0.05 + a * 0.03, 0.05 + a * 0.2, "sine");
    this.tone(3150 + a * 900, 0.028, 0.02 + a * 0.09, "sine", 8);
    this.burst(2600, 1.4, 0.03, 0.05 + a * 0.16);
  }

  /** cushion thump */
  cushion(v: number) {
    if (!this.sfxOn) return;
    const now = performance.now();
    if (now - this.lastCushion < 40) return;
    this.lastCushion = now;
    const a = Math.min(1, v / 260);
    if (a < 0.04) return;
    this.tone(96 + a * 46, 0.1 + a * 0.06, 0.06 + a * 0.22, "sine");
    this.burst(420, 0.9, 0.07, 0.03 + a * 0.1, 0, "lowpass");
  }

  cue(power: number) {
    if (!this.sfxOn) return;
    const a = Math.min(1, Math.max(0.1, power));
    this.tone(190 + a * 90, 0.07, 0.1 + a * 0.2, "triangle");
    this.burst(900 + a * 700, 1.1, 0.05, 0.08 + a * 0.2);
    this.burst(220, 0.7, 0.09, 0.05 + a * 0.09, 0, "lowpass");
  }

  pocket() {
    if (!this.sfxOn) return;
    this.tone(240, 0.1, 0.16, "sine");
    this.tone(150, 0.22, 0.2, "sine", 0, 0.05);
    this.burst(300, 0.7, 0.28, 0.16, 0.03, "lowpass");
    this.burst(1400, 1.6, 0.1, 0.05, 0.13);
  }

  rack() {
    if (!this.sfxOn) return;
    for (let i = 0; i < 9; i++) {
      this.tone(900 + Math.random() * 1500, 0.05, 0.05 + Math.random() * 0.08, "sine", 0, i * 0.028 + Math.random() * 0.02);
    }
    this.burst(300, 0.6, 0.3, 0.1, 0, "lowpass");
  }

  win() {
    if (!this.sfxOn) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone(f, 0.5, 0.14, "triangle", 0, i * 0.11);
      this.tone(f * 2, 0.3, 0.05, "sine", 0, i * 0.11);
    });
  }

  lose() {
    if (!this.sfxOn) return;
    [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.42, 0.13, "sawtooth", -6, i * 0.14));
  }

  foul() {
    if (!this.sfxOn) return;
    this.tone(180, 0.3, 0.16, "square");
    this.tone(140, 0.36, 0.14, "square", 0, 0.1);
  }

  ui(up = true) {
    if (!this.sfxOn) return;
    this.tone(up ? 720 : 480, 0.06, 0.05, "triangle");
    this.tone(up ? 1180 : 340, 0.05, 0.03, "sine", 0, 0.03);
  }

  coin() {
    if (!this.sfxOn) return;
    this.tone(1320, 0.09, 0.09, "triangle");
    this.tone(1760, 0.16, 0.07, "triangle", 0, 0.06);
  }

  tick() {
    if (!this.sfxOn) return;
    this.tone(1500, 0.03, 0.035, "square");
  }
}

export const sfx = new SoundEngine();

export function haptic(ms: number | number[], enabled: boolean) {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* noop */
  }
}
