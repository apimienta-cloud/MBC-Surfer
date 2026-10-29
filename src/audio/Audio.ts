import { config } from '../config';

const A = config.audio;

export type Sfx = 'jump' | 'roll' | 'coin' | 'powerup' | 'stumble' | 'crash' | 'caught' | 'click' | 'shield' | 'mission' | 'land';

/**
 * Sonido con Web Audio. Efectos sintetizados (sin archivos) y música:
 * si existe public/assets/audio/musica.mp3 se usa ese archivo; si no, un loop sintetizado.
 * El contexto se crea en el primer gesto del usuario (requisito de iOS/Chrome).
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private muted = false;
  private musicOn = false;
  private musicEl: HTMLAudioElement | null = null;
  private musicFileOk = false;
  private nextBeat = 0;
  private beat = 0;
  private timer = 0;
  private coinPitch = 0;
  private coinPitchAt = 0;

  constructor() {
    // Si existe el archivo de música de la marca, se usa
    fetch(A.musicFile, { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') ?? '';
        this.musicFileOk = r.ok && type.startsWith('audio');
      })
      .catch(() => undefined);
  }

  /** Llamar desde un gesto del usuario (botón Jugá). */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = A.sfxVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = A.musicVolume;
      this.musicGain.connect(this.master);
      // Ruido blanco para golpes y "whoosh"
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setMuted(this.muted);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    if (this.musicEl) this.musicEl.muted = m;
  }

  // ---------- Efectos ----------

  play(s: Sfx): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime;
    switch (s) {
      case 'jump':
        this.tone('square', 300, 620, t, 0.12, 0.18);
        break;
      case 'land':
        this.thump(t, 0.08, 120, 0.2);
        break;
      case 'roll':
        this.whoosh(t, 0.3, 900, 300, 0.3);
        break;
      case 'coin': {
        // Las fichitas seguidas van subiendo de tono
        this.coinPitch = t - this.coinPitchAt < 0.4 ? Math.min(this.coinPitch + 1, 8) : 0;
        this.coinPitchAt = t;
        const f = 988 * Math.pow(2, this.coinPitch / 24);
        this.tone('sine', f, f, t, 0.06, 0.22);
        this.tone('sine', f * 1.5, f * 1.5, t + 0.05, 0.1, 0.18);
        break;
      }
      case 'powerup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.07, 0.12, 0.25));
        break;
      case 'shield':
        [784, 1175, 1568].forEach((f, i) => this.tone('sine', f, f * 1.01, t + i * 0.04, 0.5, 0.18));
        break;
      case 'mission':
        [659, 784, 988, 1319].forEach((f, i) => this.tone('square', f, f, t + i * 0.09, 0.14, 0.12));
        break;
      case 'stumble':
        this.thump(t, 0.15, 90, 0.5);
        this.tone('sawtooth', 220, 140, t, 0.25, 0.12);
        break;
      case 'crash':
        this.thump(t, 0.3, 70, 0.8);
        this.whoosh(t, 0.35, 2500, 400, 0.4);
        break;
      case 'caught':
        // "Uaaa-uaaa" de trompeta triste
        this.tone('sawtooth', 392, 370, t, 0.35, 0.16);
        this.tone('sawtooth', 370, 349, t + 0.38, 0.35, 0.16);
        this.tone('sawtooth', 349, 262, t + 0.76, 0.7, 0.16);
        break;
      case 'click':
        this.tone('triangle', 660, 880, t, 0.05, 0.15);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, out?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private thump(t: number, dur: number, freq: number, vol: number, out?: AudioNode): void {
    this.tone('sine', freq * 2, freq * 0.5, t, dur, vol, out);
  }

  private whoosh(t: number, dur: number, f0: number, f1: number, vol: number, out?: AudioNode): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(out ?? this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  // ---------- Música ----------

  startMusic(): void {
    if (this.musicOn) return;
    this.musicOn = true;
    if (this.musicFileOk) {
      if (!this.musicEl) {
        this.musicEl = new window.Audio(A.musicFile);
        this.musicEl.loop = true;
        this.musicEl.volume = A.musicVolume * 2;
      }
      this.musicEl.muted = this.muted;
      this.musicEl.play().catch(() => undefined);
      return;
    }
    if (!this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stopMusic(): void {
    this.musicOn = false;
    this.musicEl?.pause();
    clearInterval(this.timer);
  }

  /** Loop sintetizado: bajo, acordes cortos y percusión con aire de candombe livianito. */
  private schedule(): void {
    const c = this.ctx;
    if (!c) return;
    const step = 60 / A.musicTempo / 2; // corcheas
    const bass = [110, 110, 147, 147, 131, 131, 98, 98];
    const chord = [
      [440, 554, 659],
      [440, 554, 659],
      [587, 740, 880],
      [587, 740, 880],
      [523, 659, 784],
      [523, 659, 784],
      [392, 494, 587],
      [392, 494, 587],
    ];
    while (this.nextBeat < c.currentTime + 0.2) {
      const t = this.nextBeat;
      const b = this.beat % 64;
      const bar = Math.floor(b / 8);
      const pos = b % 8;
      // Tambor: golpes en 1, la "y" del 2 y el 4 (patrón tipo chico-repique simplificado)
      if (pos === 0 || pos === 3 || pos === 6) this.thump(t, 0.12, pos === 0 ? 80 : 110, 0.6, this.musicGain);
      if (pos % 2 === 1) this.whoosh(t, 0.04, 8000, 6000, 0.12, this.musicGain);
      if (pos === 0 || pos === 4) this.tone('triangle', bass[bar], bass[bar], t, step * 3, 0.35, this.musicGain);
      if (pos === 2 || pos === 6) for (const f of chord[bar]) this.tone('square', f, f, t, step * 0.6, 0.035, this.musicGain);
      this.nextBeat += step;
      this.beat++;
    }
  }
}
