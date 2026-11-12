// Every sound is synthesised in WebAudio. No samples.
import { lerp } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.muted = false;
    this.birds = 0;
    this._bird = 2;
    this.muz = false;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let c;
    try {
      c = this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    const bus = (v) => {
      const g = c.createGain();
      g.gain.value = v;
      g.connect(this.master);
      return g;
    };
    this.amb = bus(1);
    this.sfx = bus(1);
    this.voice = bus(1);
    this.mus = bus(1);

    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const rl = Math.floor(c.sampleRate * 2.4);
    const ir = c.createBuffer(2, rl, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const x = ir.getChannelData(ch);
      for (let i = 0; i < rl; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.8);
    }
    this.rev = c.createConvolver();
    this.rev.buffer = ir;
    const rg = c.createGain();
    rg.gain.value = 0.45;
    this.rev.connect(rg);
    rg.connect(this.master);
    this.on = true;
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }
  setMuted(m) {
    this.muted = m;
    if (this.on) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.04);
  }
  _noise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }
  _out(node, o) {
    node.connect(o.dest || this.sfx);
    if (o.rev) {
      const s = this.ctx.createGain();
      s.gain.value = o.rev;
      node.connect(s);
      s.connect(this.rev);
    }
  }
  // One-shot pitched voice.
  tone(o) {
    if (!this.on) return;
    const c = this.ctx;
    const t0 = c.currentTime + (o.t || 0);
    const a = o.a ?? 0.005;
    const d = o.d ?? 0.2;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.ft || d));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.v ?? 0.2, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    let n = osc;
    if (o.lp || o.bp) {
      const f = c.createBiquadFilter();
      f.type = o.bp ? 'bandpass' : 'lowpass';
      f.frequency.value = o.bp || o.lp;
      f.Q.value = o.q ?? 1;
      n.connect(f);
      n = f;
    }
    n.connect(g);
    this._out(g, o);
    osc.start(t0);
    osc.stop(t0 + a + d + 0.05);
  }
  // One-shot filtered noise.
  hit(o) {
    if (!this.on) return;
    const c = this.ctx;
    const t0 = c.currentTime + (o.t || 0);
    const a = o.a ?? 0.003;
    const d = o.d ?? 0.1;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + a + d);
    f.Q.value = o.q ?? 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.v ?? 0.2, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    s.connect(f);
    f.connect(g);
    this._out(g, o);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + a + d + 0.05);
  }

  // ---- shuttle -----------------------------------------------------------
  startEngine() {
    if (!this.on || this.eng) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 210;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 44;
    const o2 = c.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 66;
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    o1.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(this.amb);
    const n = this._noise();
    const nf = c.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 150;
    const ng = c.createGain();
    ng.gain.value = 0;
    n.connect(nf);
    nf.connect(ng);
    ng.connect(this.amb);
    const n2 = this._noise();
    const hf = c.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = 850;
    hf.Q.value = 0.4;
    const hg = c.createGain();
    hg.gain.value = 0;
    n2.connect(hf);
    hf.connect(hg);
    hg.connect(this.amb);
    o1.start();
    o2.start();
    n.start();
    n2.start();
    this.eng = { o1, o2, g, ng, hg };
  }
  // speed 0..1, level 0..1 (0 = engine off), muffle for hearing it from outside.
  setEngine(speed, level = 1) {
    if (!this.eng) return;
    const t = this.ctx.currentTime;
    const f = 40 + 24 * speed;
    this.eng.o1.frequency.setTargetAtTime(f, t, 0.2);
    this.eng.o2.frequency.setTargetAtTime(f * 1.503, t, 0.2);
    this.eng.g.gain.setTargetAtTime(level * (0.11 + 0.05 * speed), t, 0.25);
    this.eng.ng.gain.setTargetAtTime(level * (0.3 + 0.5 * speed), t, 0.25);
    this.eng.hg.gain.setTargetAtTime(level * 0.05 * speed, t, 0.25);
  }
  bumpHit(v = 1) {
    this.tone({ f: 95, f2: 40, d: 0.18, v: 0.5 * v, a: 0.004 });
    this.hit({ f: 420, d: 0.1, v: 0.25 * v });
    this.hit({ f: 2800, type: 'highpass', d: 0.16, v: 0.07 * v, t: 0.03 });
    this.hit({ f: 3400, type: 'highpass', d: 0.1, v: 0.04 * v, t: 0.16 });
  }
  brake() {
    this.tone({ f: 2150, f2: 1750, d: 0.7, v: 0.012, a: 0.15 });
    this.hit({ f: 3200, f2: 900, type: 'bandpass', q: 0.8, d: 0.6, v: 0.06, t: 0.75 });
  }
  door() {
    this.hit({ f: 3800, f2: 700, type: 'bandpass', q: 0.9, d: 0.75, v: 0.16, a: 0.03 });
    this.tone({ f: 120, f2: 70, d: 0.12, v: 0.3, t: 0.7 });
    this.hit({ f: 900, d: 0.07, v: 0.2, t: 0.7 });
  }
  chime() {
    this.tone({ f: 784, d: 0.9, v: 0.09, dest: this.voice, rev: 0.2 });
    this.tone({ f: 622, d: 1.1, v: 0.09, t: 0.32, dest: this.voice, rev: 0.2 });
  }

  // ---- tinny radio muzak -------------------------------------------------
  startMuzak() {
    if (!this.on || this.muzG) return;
    const c = this.ctx;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    this.muzG = c.createGain();
    this.muzG.gain.value = 0;
    this.muzG.gain.setTargetAtTime(0.5, c.currentTime, 2.5);
    this.muzIn = c.createGain();
    this.muzIn.connect(bp);
    bp.connect(this.muzG);
    this.muzG.connect(this.amb);
    this.muz = true;
    this.muzNext = c.currentTime + 0.2;
    this.muzStep = 0;
  }
  stopMuzak(fade = 0.05) {
    if (!this.muzG) return;
    this.muz = false;
    this.muzG.gain.setTargetAtTime(0, this.ctx.currentTime, fade);
  }
  _muzStep(i, t) {
    const bar = Math.floor(i / 8) % 4;
    const s = i % 8;
    const dt = t - this.ctx.currentTime;
    const bass = [48, 45, 50, 43][bar];
    const chord = [[64, 67, 71], [64, 67, 72], [65, 69, 72], [65, 71, 74]][bar];
    const mel = [
      { 0: 79, 2: 76, 5: 74 },
      { 0: 76, 3: 72, 6: 69 },
      { 1: 77, 3: 81, 4: 79, 6: 77 },
      { 0: 74, 2: 71, 5: 74, 7: 79 },
    ][bar];
    const dest = this.muzIn;
    if (s === 0 || s === 4) this.tone({ f: mtof(bass + (s === 4 ? 7 : 0) + 12), type: 'triangle', d: 0.3, v: 0.16, t: dt, dest });
    const stab = bar % 2 === 0 ? [0, 3, 6] : [2, 5];
    if (stab.includes(s)) for (const n of chord) this.tone({ f: mtof(n), type: 'triangle', d: 0.14, v: 0.05, t: dt, dest });
    if (mel[s] !== undefined) this.tone({ f: mtof(mel[s]), type: 'sine', d: 0.38, v: 0.1, t: dt, dest });
  }

  // ---- outdoors ----------------------------------------------------------
  startOutdoor() {
    if (!this.on || this.wind) return;
    const c = this.ctx;
    const n = this._noise();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0;
    n.connect(f);
    f.connect(g);
    g.connect(this.amb);
    n.start();
    this.wind = g;
    const n2 = this._noise();
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 3200;
    f2.Q.value = 0.5;
    const g2 = c.createGain();
    g2.gain.value = 0;
    n2.connect(f2);
    f2.connect(g2);
    g2.connect(this.amb);
    n2.start();
    this.fountain = g2;
  }
  setOutdoor(level, fountain = 0) {
    if (!this.wind) return;
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(level * (0.05 + 0.02 * Math.sin(t * 0.4)), t, 0.4);
    this.fountain.gain.setTargetAtTime(fountain * 0.035, t, 0.4);
    this.birds = level;
  }
  chirp() {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2300 + Math.random() * 2300;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + Math.random() * 0.2);
      this.tone({ f, f2: f * (1.15 + Math.random() * 0.35), d: 0.06, a: 0.012, v: 0.022 * this.birds, t: i * (0.09 + Math.random() * 0.05), dest: this.amb, rev: 0.4 });
    }
  }
  step(soft = 1) {
    this.hit({ f: 700 + Math.random() * 300, d: 0.06, v: 0.1 * soft, a: 0.002 });
    this.tone({ f: 90, f2: 60, d: 0.05, v: 0.1 * soft });
  }

  // Called once per rendered frame with real seconds.
  tick(dt) {
    if (!this.on) return;
    const now = this.ctx.currentTime;
    if (this.muz) {
      while (this.muzNext < now + 0.3) {
        this._muzStep(this.muzStep++, Math.max(this.muzNext, now + 0.01));
        this.muzNext += 0.235;
      }
    }
    if (this.birds > 0.01) {
      this._bird -= dt;
      if (this._bird <= 0) {
        this.chirp();
        this._bird = 0.6 + Math.random() * 3.2;
      }
    }
  }

  // ---- voices ------------------------------------------------------------
  blip(v, ch) {
    if (!this.on) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const code = ch.charCodeAt(0);
    const vowel = 'aeiouAEIOU'.includes(ch);
    const f = v.f * (1 + (((code * 13) % 9) - 4) * 0.024) * (vowel ? 1.1 : 1);
    const g = c.createGain();
    const vol = (v.v ?? 1) * 0.085;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    if (v.whisper) {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 7;
      bp.Q.value = 2.5;
      s.connect(bp);
      bp.connect(g);
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol * 2.6, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
      s.start(t0, Math.random());
      s.stop(t0 + 0.1);
    } else {
      const o = c.createOscillator();
      o.type = v.type || 'triangle';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 0.94, t0 + 0.07);
      let n = o;
      if (v.pa) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1700;
        bp.Q.value = 2.2;
        o.connect(bp);
        n = bp;
        g.gain.cancelScheduledValues(t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol * 3, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      }
      n.connect(g);
      o.start(t0);
      o.stop(t0 + 0.09);
    }
    g.connect(this.voice);
    if (v.far) {
      const s = c.createGain();
      s.gain.value = 0.5;
      g.connect(s);
      s.connect(this.rev);
    }
  }

  // ---- goose -------------------------------------------------------------
  honk({ v = 0.5, dist = 0, pitch = 1, t = 0 } = {}) {
    if (!this.on) return;
    const c = this.ctx;
    const t0 = c.currentTime + t;
    const out = c.createGain();
    out.gain.value = v;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lerp(6500, 800, dist);
    out.connect(lp);
    lp.connect(this.sfx);
    const send = c.createGain();
    send.gain.value = 0.2 + dist * 0.7;
    lp.connect(send);
    send.connect(this.rev);
    const syll = (ts, dur, fa, fb, fc, amp) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.linearRampToValueAtTime(amp, ts + 0.014);
      g.gain.linearRampToValueAtTime(amp * 0.75, ts + dur * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, ts + dur);
      const mk = (type, mul, gv) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(fa * pitch * mul, ts);
        o.frequency.linearRampToValueAtTime(fb * pitch * mul, ts + dur * 0.22);
        o.frequency.linearRampToValueAtTime(fc * pitch * mul, ts + dur);
        const og = c.createGain();
        og.gain.value = gv;
        o.connect(og);
        o.start(ts);
        o.stop(ts + dur + 0.05);
        return og;
      };
      const src = c.createGain();
      mk('sawtooth', 1, 0.7).connect(src);
      mk('square', 0.5, 0.35).connect(src);
      for (const [f, q, gv] of [[1150, 5, 1], [2450, 7, 0.6], [640, 3, 0.5]]) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f * pitch;
        bp.Q.value = q;
        const bg = c.createGain();
        bg.gain.value = gv;
        src.connect(bp);
        bp.connect(bg);
        bg.connect(g);
      }
      const lfo = c.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 58;
      const lg = c.createGain();
      lg.gain.value = 0.22 * amp;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start(ts);
      lfo.stop(ts + dur + 0.05);
      g.connect(out);
    };
    syll(t0, 0.1, 320, 410, 395, 0.55);
    syll(t0 + 0.125, 0.32, 420, 610, 455, 1);
  }
  hiss(v = 0.3) {
    this.hit({ f: 5200, type: 'bandpass', q: 0.9, a: 0.08, d: 0.9, v });
  }
  flap(v = 0.2) {
    this.hit({ f: 500, f2: 180, d: 0.16, a: 0.03, v, rev: 0.1 });
  }

  // ---- score -------------------------------------------------------------
  drum(v = 0.6) {
    this.tone({ f: 88, f2: 34, d: 0.7, ft: 0.3, v, a: 0.004, rev: 0.6, dest: this.mus });
    this.hit({ f: 320, d: 0.14, v: v * 0.5, rev: 0.5, dest: this.mus });
  }
  dreadStart() {
    if (!this.on || this.dread) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    lp.Q.value = 0.8;
    const oscs = [];
    for (const [f, type, v] of [[36.7, 'sine', 0.9], [73.4, 'sawtooth', 0.3], [73.9, 'sawtooth', 0.3], [110, 'sawtooth', 0.18], [146.8, 'sawtooth', 0.12], [155.6, 'sawtooth', 0.1]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = v;
      o.connect(og);
      og.connect(lp);
      o.start();
      oscs.push(o);
    }
    lp.connect(g);
    g.connect(this.mus);
    const s = c.createGain();
    s.gain.value = 0.5;
    g.connect(s);
    s.connect(this.rev);
    g.gain.linearRampToValueAtTime(0.2, c.currentTime + 5);
    this.dread = { g, lp, oscs };
  }
  dreadRise(dur) {
    if (!this.dread) return;
    const t = this.ctx.currentTime;
    const { g, lp, oscs } = this.dread;
    lp.frequency.cancelScheduledValues(t);
    lp.frequency.setValueAtTime(lp.frequency.value, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.42, t + dur);
    for (let i = 1; i < oscs.length; i++) oscs[i].frequency.exponentialRampToValueAtTime(oscs[i].frequency.value * (1.5 + i * 0.06), t + dur);
  }
  dreadStop(fade = 0.03) {
    if (!this.dread) return;
    const t = this.ctx.currentTime;
    const { g, oscs } = this.dread;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, fade);
    for (const o of oscs) o.stop(t + fade * 8 + 0.2);
    this.dread = null;
  }
  jingle() {
    const notes = [67, 72, 76, 79, 84];
    notes.forEach((n, i) => {
      const t = i * 0.16 + (i === 4 ? 0.12 : 0);
      this.tone({ f: mtof(n), d: i === 4 ? 1.6 : 0.5, v: 0.14, t, dest: this.mus, rev: 0.3 });
      this.tone({ f: mtof(n) * 4, d: 0.12, v: 0.04, t, dest: this.mus });
    });
  }

  // ---- props -------------------------------------------------------------
  click() {
    this.tone({ f: 1400, d: 0.03, v: 0.06, type: 'square', lp: 3000 });
  }
  shutter() {
    this.hit({ f: 2500, type: 'highpass', d: 0.02, v: 0.3 });
    this.hit({ f: 1800, type: 'highpass', d: 0.035, v: 0.25, t: 0.07 });
  }
  printer() {
    for (let i = 0; i < 22; i++) this.tone({ f: 700 + Math.random() * 700, type: 'square', d: 0.03, v: 0.03, t: i * 0.055, lp: 2400 });
    this.tone({ f: 110, type: 'sawtooth', d: 1.2, v: 0.03, a: 0.1, lp: 400 });
  }
  bell() {
    this.tone({ f: 2093, d: 1.4, v: 0.12, rev: 0.3 });
    this.tone({ f: 4190, d: 0.7, v: 0.05, rev: 0.3 });
  }
  thud(v = 0.5) {
    this.tone({ f: 120, f2: 45, d: 0.25, v, a: 0.003 });
    this.hit({ f: 600, d: 0.12, v: v * 0.5 });
  }
  clack() {
    this.hit({ f: 2200, type: 'bandpass', q: 2, d: 0.05, v: 0.3 });
    this.tone({ f: 340, d: 0.06, v: 0.15, type: 'square', lp: 1200 });
  }
  clap() {
    this.hit({ f: 1500, type: 'bandpass', q: 1.2, d: 0.07, v: 0.22, rev: 0.25 });
  }
  whoosh(v = 0.2) {
    this.hit({ f: 300, f2: 1400, type: 'bandpass', q: 0.8, a: 0.25, d: 0.5, v, rev: 0.2 });
  }
}
