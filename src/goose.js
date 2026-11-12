// One articulated Canada goose. Facing +Z, origin at ground level.
import { THREE, lam, lerp, clamp, damp, sphGeo, cylGeo, mesh, box } from './util.js';

const BROWN = '#8a7a66';
const DARK = '#5f5446';
const BLACK = '#17181a';
const CREAM = '#d9cfc0';
const WHITE = '#f2efe8';

export class Goose {
  constructor() {
    const g = (this.group = new THREE.Group());
    g.rotation.order = 'YXZ';
    const body = (this.body = new THREE.Group());
    body.position.y = 0.36;
    g.add(body);
    const ell = (r, sx, sy, sz, c, x, y, z) => {
      const m = mesh(sphGeo(1, 14, 10), c, x, y, z);
      m.scale.set(r * sx, r * sy, r * sz);
      body.add(m);
      return m;
    };
    ell(1, 0.2, 0.185, 0.36, BROWN, 0, 0, 0);
    ell(1, 0.185, 0.12, 0.33, DARK, 0, 0.075, -0.02);
    ell(1, 0.16, 0.165, 0.17, CREAM, 0, -0.015, 0.215);
    ell(1, 0.15, 0.12, 0.17, WHITE, 0, -0.05, -0.25);
    const tail = (this.tail = box(0.17, 0.03, 0.2, BLACK, 0, 0.05, -0.4));
    tail.rotation.x = -0.25;
    body.add(tail);

    // neck chain
    const n0 = (this.n0 = new THREE.Group());
    n0.position.set(0, 0.09, 0.27);
    body.add(n0);
    n0.add(mesh(cylGeo(0.04, 0.052, 0.2, 8), BLACK, 0, 0.1, 0));
    const n1 = (this.n1 = new THREE.Group());
    n1.position.y = 0.19;
    n0.add(n1);
    n1.add(mesh(cylGeo(0.034, 0.04, 0.19, 8), BLACK, 0, 0.09, 0));
    const head = (this.head = new THREE.Group());
    head.position.y = 0.185;
    n1.add(head);
    const skull = mesh(sphGeo(1, 12, 9), BLACK, 0, 0.025, 0.025);
    skull.scale.set(0.05, 0.05, 0.07);
    head.add(skull);
    for (const s of [1, -1]) {
      const cheek = mesh(sphGeo(1, 8, 6), WHITE, s * 0.036, 0.008, 0.012);
      cheek.scale.set(0.02, 0.034, 0.042);
      head.add(cheek);
      head.add(mesh(sphGeo(0.008, 6, 5), '#3a2a12', s * 0.04, 0.04, 0.055));
    }
    head.add(box(0.06, 0.02, 0.05, WHITE, 0, -0.022, 0.012));
    head.add(box(0.036, 0.018, 0.075, BLACK, 0, 0.022, 0.115));
    const jaw = (this.jaw = new THREE.Group());
    jaw.position.set(0, 0.012, 0.08);
    head.add(jaw);
    jaw.add(box(0.03, 0.011, 0.065, '#24201c', 0, -0.006, 0.032));
    jaw.add(box(0.018, 0.004, 0.05, '#c96a6a', 0, 0.001, 0.028));

    // wings: +x is the bird's left
    this.wings = [];
    for (const s of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.15, 0.09, 0.08);
      body.add(w);
      const inner = box(0.42, 0.028, 0.3, DARK, s * 0.21, 0, -0.03);
      w.add(inner);
      w.add(box(0.4, 0.02, 0.1, '#4a4136', s * 0.21, -0.004, -0.2));
      const o = new THREE.Group();
      o.position.set(s * 0.42, 0, 0);
      w.add(o);
      o.add(box(0.44, 0.022, 0.24, '#4a4136', s * 0.22, 0, -0.04));
      o.add(box(0.3, 0.016, 0.1, '#2f2a24', s * 0.3, -0.003, -0.18));
      this.wings.push({ w, o, s });
    }
    this.legs = [];
    for (const s of [1, -1]) {
      const l = new THREE.Group();
      l.position.set(s * 0.075, -0.13, -0.03);
      body.add(l);
      l.add(mesh(cylGeo(0.013, 0.013, 0.22, 6), '#2e2e30', 0, -0.11, 0));
      l.add(box(0.085, 0.012, 0.13, '#2e2e30', 0, -0.225, 0.04));
      this.legs.push({ l, s });
    }
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });

    // pose state (targets are damped towards)
    this.p = { spread: 0, ext: 0, low: 0, beak: 0, tuck: 0, pitch: 0, flap: 0 };
    this.t = { spread: 0, ext: 0, low: 0, beak: 0, tuck: 0, pitch: 0, flap: 0 };
    this.flapRate = 16;
    this.flapPhase = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.lookYaw = 0;
    this.lookYawT = 0;
    this.lookPitchT = 0;
    this.lookPitch = 0;
    this.rate = 8;
    this.shiver = 0;
    this.squash = 0;
  }
  pose(name) {
    const T = this.t;
    if (name === 'stand') Object.assign(T, { spread: 0, ext: 0, low: 0, beak: 0, tuck: 0, pitch: 0, flap: 0 });
    if (name === 'fly') Object.assign(T, { spread: 1, ext: 1, low: 0, beak: 0, tuck: 1, pitch: -0.05, flap: 0.75 });
    if (name === 'glide') Object.assign(T, { spread: 1, ext: 1, low: 0, beak: 0, tuck: 1, pitch: -0.1, flap: 0.06 });
    if (name === 'flare') Object.assign(T, { spread: 1, ext: 0.35, low: 0, beak: 0.5, tuck: -0.45, pitch: -0.7, flap: 1.0 });
    if (name === 'hiss') Object.assign(T, { spread: 0.42, ext: 0.9, low: 1, beak: 1, tuck: 0, pitch: 0.2, flap: 0 });
    if (name === 'honk') Object.assign(T, { spread: 0.25, ext: 0.3, low: 0, beak: 1, tuck: 0, pitch: -0.15, flap: 0 });
    this.poseName = name;
  }
  snap() {
    Object.assign(this.p, this.t);
  }
  update(dt, t) {
    const P = this.p;
    const T = this.t;
    for (const k in P) P[k] = damp(P[k], T[k], this.rate, dt);
    this.flapPhase += dt * this.flapRate;
    if (this.speed > 0.02) this.walkPhase += dt * this.speed * 9;
    const wk = clamp(this.speed / 0.5, 0, 1) * (1 - P.tuck > 0 ? 1 : 0) * (1 - P.spread);
    const sw = Math.sin(this.walkPhase);

    this.squash = damp(this.squash, 0, 9, dt);
    this.body.position.y = 0.36 - this.squash * 0.07 + Math.abs(sw) * 0.012 * wk;
    this.body.rotation.x = P.pitch;
    this.body.rotation.z = sw * 0.11 * wk;
    this.body.scale.y = 1 - this.squash * 0.18;

    // neck: upright S when standing, straight out when flying, low when hissing
    const a0 = lerp(0.42, 1.32, P.ext) + P.low * 0.22 + Math.sin(this.walkPhase * 2) * 0.07 * wk;
    const a1 = lerp(-0.55, 0.14, P.ext) + P.low * 0.1;
    this.n0.rotation.x = a0;
    this.n1.rotation.x = a1;
    this.lookYaw = damp(this.lookYaw, this.lookYawT, 6, dt);
    this.lookPitch = damp(this.lookPitch, this.lookPitchT, 6, dt);
    this.n0.rotation.y = this.lookYaw * 0.5;
    this.head.rotation.y = this.lookYaw * 0.5;
    this.head.rotation.x = -(a0 + a1) - P.pitch * 0.85 + this.lookPitch + Math.sin(t * 40) * this.shiver * 0.03;
    this.jaw.rotation.x = P.beak * 0.55;

    const flap = Math.sin(this.flapPhase);
    const flap2 = Math.sin(this.flapPhase - 0.7);
    for (const W of this.wings) {
      const fold = 1 - P.spread;
      W.w.rotation.y = W.s * fold * 1.42;
      W.w.rotation.z = W.s * (lerp(0.1, -0.42, fold) + flap * 0.75 * P.flap + Math.sin(t * 31) * this.shiver * 0.05);
      W.w.rotation.x = fold * 0.12 - P.flap * 0.12;
      W.o.rotation.y = W.s * fold * 0.2;
      W.o.rotation.z = W.s * (flap2 * 0.6 * P.flap - (1 - fold) * 0.05);
    }
    this.legs.forEach((L, i) => {
      const walk = Math.sin(this.walkPhase + i * Math.PI) * 0.6 * wk;
      L.l.rotation.x = walk + P.tuck * 1.35;
    });
    this.tail.rotation.x = -0.25 + P.spread * 0.2 + Math.sin(t * 9) * 0.04 * (1 - P.spread);
    this.shiver = damp(this.shiver, 0, 2.5, dt);
  }
  // Turn the head toward a world point (limited range).
  lookAt(p) {
    this.group.updateWorldMatrix(true, false);
    const v = this.group.worldToLocal(p.clone());
    this.lookYawT = clamp(Math.atan2(v.x, v.z), -1.5, 1.5);
    this.lookPitchT = clamp(-Math.atan2(v.y - 0.75, Math.hypot(v.x, v.z)), -0.5, 0.5);
  }
}

// A static, simplified goose for flocks on the pond (instanced).
export function gooseBlueprint() {
  const g = new Goose();
  g.pose('stand');
  g.snap();
  g.update(0.016, 0);
  for (const L of g.legs) L.l.visible = false;
  g.body.position.y = 0.1;
  return g.group;
}
