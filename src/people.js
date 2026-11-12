// Low-poly people built from primitives, with sit / stand / walk / talk / look.
import { THREE, lam, lerp, clamp, damp, dampAngle, boxGeo, cylGeo, sphGeo, capGeo, mesh, box } from './util.js';

const V = new THREE.Vector3();
const V2 = new THREE.Vector3();
const flat = { flatShading: true };

function darker(hex, k = 0.8) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

export class Person {
  constructor(o) {
    this.o = o;
    this.id = o.id;
    const g = (this.group = new THREE.Group());
    g.name = o.id;
    g.rotation.order = 'YXZ';
    const k = (this.k = (o.height || 1.7) / 1.7);
    const root = (this.root = new THREE.Group());
    root.scale.setScalar(k);
    g.add(root);

    const skin = o.skin || '#e2b48c';
    const top = o.top || '#7a8794';
    const pants = o.pants || '#3b414d';
    const shoes = o.shoes || '#26262a';
    const wide = o.wide || 1;
    const tw = 0.37 * wide;
    const td = 0.215 * (o.deep || 1);

    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.91;
    root.add(hips);
    hips.add(box(0.33 * wide, 0.17, td * 0.98, pants, 0, -0.01, 0));

    const torso = (this.torso = new THREE.Group());
    torso.position.y = 0.06;
    hips.add(torso);
    torso.add(box(tw, 0.47, td, top, 0, 0.245, 0));
    if (o.shirt) {
      torso.add(box(0.11, 0.4, 0.012, o.shirt, 0, 0.27, td / 2 + 0.002));
      if (o.tie) torso.add(box(0.045, 0.3, 0.012, o.tie, 0, 0.29, td / 2 + 0.012));
    }
    if (o.collar) torso.add(box(0.2, 0.05, td + 0.02, o.collar, 0, 0.47, 0));

    const neck = (this.neck = new THREE.Group());
    neck.position.set(0, 0.49, 0);
    torso.add(neck);
    neck.add(mesh(cylGeo(0.048, 0.055, 0.09, 10), skin, 0, 0.035, 0));
    const head = (this.head = new THREE.Group());
    head.position.set(0, 0.185, 0.012);
    neck.add(head);
    const skull = mesh(sphGeo(0.125, 18, 14), skin);
    skull.scale.set(0.95, 1.08, 1.0);
    head.add(skull);
    for (const s of [1, -1]) head.add(mesh(sphGeo(0.026, 8, 6), skin, s * 0.118, -0.005, 0));
    head.add(box(0.026, 0.034, 0.03, darker(skin, 0.9), 0, -0.012, 0.122));
    const eyeM = lam('#1c1a1a');
    this.eyes = [];
    this.brows = [];
    for (const s of [1, -1]) {
      const e = mesh(sphGeo(0.017, 8, 6), eyeM, s * 0.046, 0.018, 0.109);
      head.add(e);
      this.eyes.push(e);
      const b = box(0.044, 0.009, 0.012, o.brow || o.hair || '#3a2e28', s * 0.046, 0.052, 0.114);
      b.rotation.z = s * (o.browTilt || 0);
      head.add(b);
      this.brows.push(b);
    }
    this.mouth = box(0.05, 0.009, 0.012, '#6b2f2f', 0, -0.062, 0.112);
    head.add(this.mouth);
    this.buildHair(o, head);

    // arms: +x is the figure's left
    this.arms = {};
    for (const [key, s] of [['L', 1], ['R', -1]]) {
      const sh = new THREE.Group();
      sh.position.set(s * (tw / 2 + 0.047), 0.44, 0);
      torso.add(sh);
      sh.add(mesh(capGeo(0.047, 0.19), top, 0, -0.135, 0));
      const el = new THREE.Group();
      el.position.y = -0.27;
      sh.add(el);
      el.add(mesh(capGeo(0.041, 0.17), o.shortSleeves ? skin : top, 0, -0.12, 0));
      const hand = new THREE.Group();
      hand.position.y = -0.265;
      el.add(hand);
      hand.add(mesh(sphGeo(0.043, 8, 6), skin));
      this.arms[key] = { sh, el, hand, s, cur: { x: 0, z: 0, f: 0 }, pose: null };
    }
    this.legs = {};
    for (const [key, s] of [['L', 1], ['R', -1]]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.095 * wide, -0.04, 0);
      hips.add(hip);
      hip.add(mesh(capGeo(0.072, 0.28), pants, 0, -0.21, 0));
      const knee = new THREE.Group();
      knee.position.y = -0.42;
      hip.add(knee);
      knee.add(mesh(capGeo(0.057, 0.28), pants, 0, -0.2, 0));
      knee.add(box(0.1, 0.075, 0.25, shoes, 0, -0.415, 0.055));
      this.legs[key] = { hip, knee, s };
    }

    this.sit = 0;
    this.sitTarget = 0;
    this.seatY = 0.5;
    this.lean = o.lean || 0;
    this.speed = 0;
    this.walkPhase = Math.random() * 6;
    this.path = null;
    this.lookTarget = null;
    this.lookRate = 5;
    this.hy = 0;
    this.hp = 0;
    this.headPitch = 0;
    this.headRoll = 0;
    this.talk = 0;
    this.mouthOpen = 0;
    this.blinkT = 1 + Math.random() * 4;
    this.eyesClosed = 0;
    this.asleep = false;
    this.fidget = o.fidget || 0;
    this.seed = Math.random() * 100;
    this.faceYaw = null;
    this.sitArms = o.sitArms || { L: { x: -0.2, z: 0.05, f: -1.0 }, R: { x: -0.2, z: -0.05, f: -1.0 } };
    this.standArms = o.standArms || { L: { x: 0, z: 0.06, f: -0.12 }, R: { x: 0, z: -0.06, f: -0.12 } };
  }

  buildHair(o, head) {
    const c = o.hair || '#3a2e28';
    const style = o.hairStyle || 'short';
    const add = (m) => (head.add(m), m);
    const cap = (r, sx, sy, sz, y = 0.02, z = -0.012, phi = 0.56) => {
      const m = mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * phi), lam(c), 0, y, z);
      m.scale.set(sx, sy, sz);
      return add(m);
    };
    if (style === 'short') {
      cap(0.132, 0.98, 1.08, 1.02);
      add(box(0.17, 0.034, 0.045, c, 0, 0.112, 0.07)).rotation.x = -0.5;
    } else if (style === 'bob') {
      cap(0.137, 1.02, 1.08, 1.05);
      const backHair = mesh(new THREE.SphereGeometry(0.139, 16, 12, Math.PI, Math.PI, 0, Math.PI * 0.8), lam(c), 0, 0.012, -0.004);
      backHair.scale.set(1.04, 1.1, 1.1);
      add(backHair);
      add(box(0.2, 0.03, 0.045, c, 0, 0.1, 0.085)).rotation.x = -0.5;
    } else if (style === 'bun') {
      cap(0.134, 0.99, 1.08, 1.03);
      add(mesh(sphGeo(0.058, 10, 8), c, 0, 0.15, -0.075));
    } else if (style === 'buzz') {
      cap(0.129, 0.97, 1.07, 1.01, 0.02, -0.008, 0.5);
    } else if (style === 'beanie') {
      const m = cap(0.14, 1.0, 1.05, 1.03, 0.025, -0.005, 0.5);
      m.material = lam(o.hat || '#b8452f');
      add(mesh(cylGeo(0.136, 0.136, 0.045, 16), o.hat || '#b8452f', 0, 0.035, -0.004));
    } else if (style === 'cap') {
      const hc = o.hat || '#22324a';
      const m = cap(0.137, 1.0, 1.0, 1.04, 0.03, -0.004, 0.48);
      m.material = lam(hc);
      add(box(0.19, 0.016, 0.13, hc, 0, 0.045, 0.165)).rotation.x = 0.12;
      add(box(0.25, 0.07, 0.1, c, 0, -0.01, -0.09));
    } else if (style === 'bald') {
      add(box(0.25, 0.06, 0.08, c, 0, -0.02, -0.095));
      for (const s of [1, -1]) add(box(0.02, 0.06, 0.1, c, s * 0.118, -0.0, -0.04));
    }
    if (o.beard) add(box(0.19, 0.085, 0.07, o.beard, 0, -0.085, 0.07));
    if (o.mustache) add(box(0.085, 0.022, 0.02, o.mustache, 0, -0.04, 0.118));
    if (o.glasses) {
      const gm = lam(o.glasses);
      for (const s of [1, -1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0045, 6, 16), gm);
        ring.position.set(s * 0.046, 0.018, 0.123);
        head.add(ring);
        add(box(0.004, 0.006, 0.11, o.glasses, s * 0.116, 0.02, 0.07));
      }
      add(box(0.03, 0.005, 0.005, o.glasses, 0, 0.022, 0.125));
      if (o.glassesChain) for (const s of [1, -1]) add(box(0.004, 0.12, 0.004, o.glassesChain, s * 0.118, -0.05, 0.02));
    }
    if (o.headset) {
      const hm = '#22262b';
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.008, 6, 16, Math.PI), lam(hm));
      band.position.y = 0.01;
      head.add(band);
      add(box(0.02, 0.05, 0.045, hm, 0.128, 0.0, 0));
      const boom = box(0.006, 0.006, 0.12, hm, 0.118, -0.05, 0.06);
      boom.rotation.x = 0.35;
      add(boom);
      add(mesh(sphGeo(0.012, 6, 5), hm, 0.1, -0.072, 0.118));
    }
  }

  // ---- wardrobe ----------------------------------------------------------
  addLanyard(color = '#1f9aa0') {
    const g = new THREE.Group();
    const td = 0.215 * (this.o.deep || 1);
    const z = td / 2 + 0.014;
    for (const s of [1, -1]) {
      const st = box(0.014, 0.3, 0.006, color, s * 0.05, 0.345, z);
      st.rotation.z = s * 0.33;
      g.add(st);
    }
    g.add(box(0.075, 0.1, 0.008, '#f7f5ef', 0, 0.16, z + 0.004));
    g.add(box(0.075, 0.025, 0.009, '#1f9aa0', 0, 0.197, z + 0.005));
    g.add(box(0.03, 0.036, 0.009, '#9aa7ad', 0, 0.158, z + 0.006));
    this.torso.add(g);
    this.lanyard = g;
    return g;
  }
  addVest(color = '#d9ef3a') {
    const tw = 0.37 * (this.o.wide || 1);
    const td = 0.215 * (this.o.deep || 1);
    for (const s of [1, -1]) this.torso.add(box(tw * 0.42, 0.44, td + 0.03, color, s * tw * 0.27, 0.25, 0));
    this.torso.add(box(tw + 0.02, 0.44, 0.03, color, 0, 0.25, -td / 2));
    for (const y of [0.13, 0.3]) this.torso.add(box(tw + 0.035, 0.035, td + 0.04, '#c9ced2', 0, y, 0));
  }
  addHood(color) {
    const h = mesh(sphGeo(0.13, 10, 8), color, 0, 0.5, -0.09);
    h.scale.set(1.15, 0.75, 0.9);
    this.torso.add(h);
    this.torso.add(box(0.2, 0.1, 0.012, darker(color, 0.85), 0, 0.12, 0.215 / 2 + 0.004));
  }
  addCardigan(color) {
    const tw = 0.37 * (this.o.wide || 1);
    const td = 0.215 * (this.o.deep || 1);
    for (const s of [1, -1]) this.torso.add(box(tw * 0.36, 0.46, td + 0.025, color, s * tw * 0.33, 0.245, 0));
    this.torso.add(box(tw + 0.02, 0.46, 0.03, color, 0, 0.245, -td / 2));
  }
  addBackpack(color) {
    const g = new THREE.Group();
    g.add(box(0.34, 0.48, 0.2, color, 0, 0, 0));
    g.add(box(0.26, 0.16, 0.05, darker(color, 0.8), 0, -0.1, 0.12));
    g.add(box(0.3, 0.05, 0.21, '#e9e3d2', 0, 0.2, 0));
    return g;
  }
  hold(side, obj) {
    this.arms[side].hand.add(obj);
    return obj;
  }

  // ---- behaviour ---------------------------------------------------------
  setArms(side, pose) {
    this.arms[side].pose = pose;
  }
  pulse() {
    this.mouthOpen = 1;
  }
  setWorldPos(v) {
    this.group.position.copy(v);
  }
  // Walk through world-space points. Resolves when the last one is reached.
  walk(points, speed = 1.3, finalYaw = null) {
    return new Promise((res) => {
      this.path = { pts: points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), i: 0, speed, res, finalYaw };
      this.sitTarget = 0;
    });
  }
  face(yaw) {
    this.faceYaw = yaw;
  }
  facePoint(p) {
    this.faceYaw = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
  }

  update(dt, t) {
    const g = this.group;
    // path following
    if (this.path) {
      const P = this.path;
      const target = P.pts[P.i];
      V.copy(target).sub(g.position);
      const dist = Math.hypot(V.x, V.z);
      const step = P.speed * dt;
      if (dist <= step + 0.001) {
        g.position.copy(target);
        P.i++;
        if (P.i >= P.pts.length) {
          this.path = null;
          this.speed = 0;
          if (P.finalYaw !== null) this.faceYaw = P.finalYaw;
          P.res();
        }
      } else {
        g.position.x += (V.x / dist) * step;
        g.position.z += (V.z / dist) * step;
        g.position.y += clamp(V.y, -step * 1.2, step * 1.2);
        this.speed = P.speed;
        this.faceYaw = Math.atan2(V.x, V.z);
      }
    }
    if (this.faceYaw !== null) g.rotation.y = dampAngle(g.rotation.y, this.faceYaw, 9, dt);

    const sit = (this.sit = damp(this.sit, this.sitTarget, 7, dt));
    if (this.speed > 0.05) this.walkPhase += (dt * this.speed * 3.6) / this.k;
    const wa = Math.min(1, this.speed / 1.1) * (1 - sit);
    this.wa = damp(this.wa || 0, wa, 10, dt);
    const ph = this.walkPhase;
    const sw = Math.sin(ph);

    this.hips.position.y = lerp(0.91 + (Math.abs(sw) - 0.5) * 0.028 * this.wa, this.seatY, sit);
    this.torso.rotation.x = lerp(0.04 * this.wa, this.lean, sit) + Math.sin(t * 1.3 + this.seed) * 0.008;
    this.torso.rotation.z = Math.sin(ph) * 0.03 * this.wa;

    const fid = this.fidget ? Math.max(0, Math.sin(t * 13 + this.seed)) * this.fidget * sit : 0;
    for (const key of ['L', 'R']) {
      const L = this.legs[key];
      const p = key === 'L' ? ph : ph + Math.PI;
      const stand = -Math.sin(p) * 0.6 * this.wa;
      const kneeStand = Math.max(0, Math.cos(p)) * 0.85 * this.wa;
      L.hip.rotation.x = lerp(stand, -Math.PI / 2 + 0.02, sit);
      L.hip.rotation.z = lerp(0, L.s * (this.o.kneeSpread ?? 0.06), sit);
      L.knee.rotation.x = lerp(kneeStand, Math.PI / 2 - 0.05 + (key === 'R' ? fid * 0.1 : 0), sit);
    }
    for (const key of ['L', 'R']) {
      const A = this.arms[key];
      const base = sit > 0.5 ? this.sitArms[key] : this.standArms[key];
      const pose = A.pose || base;
      const swing = (key === 'L' ? 1 : -1) * Math.sin(ph) * 0.5 * this.wa;
      A.cur.x = damp(A.cur.x, pose.x + (A.pose ? 0 : swing), 9, dt);
      A.cur.z = damp(A.cur.z, pose.z, 9, dt);
      A.cur.f = damp(A.cur.f, pose.f - (A.pose ? 0 : 0.25 * this.wa), 9, dt);
      const tk = this.talk * (A.pose ? 0 : 1) * (key === 'L' ? 1 : 0.4);
      A.sh.rotation.x = A.cur.x + Math.sin(t * 5.1 + this.seed) * 0.03 * tk;
      A.sh.rotation.z = A.cur.z;
      A.el.rotation.x = A.cur.f + Math.sin(t * 6.3 + this.seed * 2) * 0.1 * tk;
    }

    // head
    let ty = 0;
    let tp = this.headPitch;
    const lt = this.lookTarget;
    if (lt) {
      if (lt.isVector3) V.copy(lt);
      else lt.getWorldPosition(V);
      this.torso.worldToLocal(V);
      V.y -= 0.675;
      ty = Math.atan2(V.x, V.z);
      tp = -Math.atan2(V.y, Math.hypot(V.x, V.z));
    }
    ty = clamp(ty, -1.3, 1.3);
    tp = clamp(tp, -0.55, 0.7);
    this.hy = damp(this.hy, ty, this.lookRate, dt);
    this.hp = damp(this.hp, tp, this.lookRate, dt);
    this.talk = Math.max(0, this.talk - dt * 2.5);
    this.neck.rotation.y = this.hy * 0.85 + Math.sin(t * 0.7 + this.seed) * 0.02;
    this.head.rotation.x = this.hp + Math.sin(t * 8 + this.seed) * 0.022 * this.talk;
    this.head.rotation.z = this.headRoll + Math.sin(t * 0.9 + this.seed * 3) * 0.012;
    this.torso.rotation.y = this.hy * 0.12;

    // face
    this.mouthOpen = Math.max(0, this.mouthOpen - dt * 11);
    this.mouth.scale.y = 1 + this.mouthOpen * 4.5;
    this.mouth.scale.x = 1 - this.mouthOpen * 0.25;
    this.blinkT -= dt;
    let lid = this.eyesClosed;
    if (this.blinkT < 0.12) lid = 1;
    if (this.blinkT < 0) this.blinkT = 1.8 + Math.random() * 4.5;
    if (this.noBlink) lid = this.eyesClosed;
    for (const e of this.eyes) e.scale.y = lerp(1, 0.12, lid);
  }
}

// ---- held props ----------------------------------------------------------
export function mug(color = '#f1ede4') {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(0.038, 0.034, 0.1, 12), color, 0, 0, 0));
  g.add(mesh(cylGeo(0.04, 0.04, 0.015, 12), '#2b2b2e', 0, 0.055, 0));
  g.add(box(0.012, 0.05, 0.03, color, 0, 0, 0.045));
  return g;
}
export function phone() {
  const g = new THREE.Group();
  g.add(box(0.07, 0.14, 0.009, '#1a1c20'));
  const scr = new THREE.Mesh(boxGeo(0.062, 0.128, 0.002), new THREE.MeshBasicMaterial({ color: '#bfe3ff' }));
  scr.position.z = 0.006;
  g.add(scr);
  return g;
}
export function binder(color = '#b23a48') {
  const g = new THREE.Group();
  g.add(box(0.27, 0.07, 0.33, color));
  g.add(box(0.25, 0.058, 0.31, '#f4f1e8', 0.006, 0, 0.006));
  g.add(box(0.27, 0.005, 0.33, color, 0, 0.036, 0));
  return g;
}
export function tablet() {
  const g = new THREE.Group();
  g.add(box(0.2, 0.27, 0.012, '#24272c'));
  const scr = new THREE.Mesh(boxGeo(0.18, 0.24, 0.002), new THREE.MeshBasicMaterial({ color: '#dff5f2' }));
  scr.position.z = 0.008;
  g.add(scr);
  const lens = mesh(cylGeo(0.012, 0.012, 0.004, 10), '#0b0c0e', 0.07, 0.1, -0.008);
  lens.rotation.x = Math.PI / 2;
  g.add(lens);
  return g;
}
export function broom() {
  const g = new THREE.Group();
  g.add(mesh(cylGeo(0.014, 0.014, 1.45, 6), '#b08a52', 0, 0.2, 0));
  g.add(box(0.36, 0.05, 0.07, '#7b4a2a', 0, -0.53, 0));
  g.add(box(0.34, 0.14, 0.05, '#d8c27a', 0, -0.62, 0));
  return g;
}
export function tote() {
  const g = new THREE.Group();
  g.add(box(0.3, 0.32, 0.09, '#f1ead8', 0, -0.26, 0));
  g.add(box(0.18, 0.1, 0.092, '#1f9aa0', 0, -0.24, 0));
  for (const s of [1, -1]) g.add(box(0.012, 0.14, 0.012, '#f1ead8', s * 0.08, -0.06, 0));
  return g;
}
export function newspaper(tex) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  g.add(m);
  return g;
}

// ---- cast ----------------------------------------------------------------
export function makeCast(tex) {
  const P = {};

  const dee = (P.dee = new Person({
    id: 'dee', height: 1.62, skin: '#c98f6b', hair: '#b9b4ae', hairStyle: 'bob', brow: '#8f8a85',
    top: '#efe6d8', pants: '#5d5f6b', shoes: '#3a2a2a', glasses: '#7a2f45', glassesChain: '#c9b26b', lean: -0.06,
    sitArms: { L: { x: -0.25, z: 0.04, f: -1.0 }, R: { x: -0.32, z: -0.05, f: -1.05 } },
  }));
  dee.addCardigan('#8d5a7a');
  const m = mug('#e9e2d0');
  m.position.set(0, -0.02, 0.05);
  m.rotation.x = 1.0;
  dee.hold('R', m);

  const toby = (P.toby = new Person({
    id: 'toby', height: 1.74, skin: '#f0c8a8', hair: '#c9772e', hairStyle: 'short', browTilt: 0.22,
    top: '#2c3e5a', shirt: '#f4f4f0', tie: '#b23a48', pants: '#b9a57e', shoes: '#4a3526', wide: 1.12, fidget: 1, lean: 0.1,
    sitArms: { L: { x: -0.55, z: -0.12, f: -0.95 }, R: { x: -0.55, z: 0.12, f: -0.95 } }, kneeSpread: 0.02,
  }));
  toby.lapPack = toby.addBackpack('#1f8f8a');
  toby.lapPack.position.set(0, 0.24, 0.29);
  toby.lapPack.rotation.x = -0.12;
  toby.hips.add(toby.lapPack);
  toby.backPack = toby.addBackpack('#1f8f8a');
  toby.backPack.position.set(0, 0.26, -0.22);
  toby.backPack.visible = false;
  toby.torso.add(toby.backPack);
  toby.book = binder('#b23a48');
  toby.book.position.set(0, 0.5, 0.3);
  toby.book.rotation.x = -0.12;
  toby.hips.add(toby.book);

  const rahul = (P.rahul = new Person({
    id: 'rahul', height: 1.78, skin: '#a8754f', hair: '#17140f', hairStyle: 'short', beard: '#17140f',
    top: '#4a4f57', pants: '#34506f', shoes: '#e8e8e4', lean: -0.3,
    sitArms: { L: { x: -0.2, z: 0.1, f: -0.75 }, R: { x: -0.75, z: -0.2, f: -1.35 } }, kneeSpread: 0.2,
  }));
  rahul.addHood('#4a4f57');
  rahul.phone = phone();
  rahul.phone.position.set(0.0, -0.05, 0.03);
  rahul.phone.rotation.set(-1.1, 0, 0);
  rahul.hold('R', rahul.phone);
  rahul.headPitch = 0.55;

  const sleeper = (P.sleeper = new Person({
    id: 'sleeper', height: 1.66, skin: '#e8c3a0', hair: '#3b2a20', hairStyle: 'beanie', hat: '#c05a2e',
    top: '#3f7a5a', pants: '#2f3138', shoes: '#5a4a3a', lean: -0.2,
  }));
  sleeper.asleep = true;
  sleeper.eyesClosed = 1;
  sleeper.noBlink = true;

  const reader = (P.reader = new Person({
    id: 'reader', height: 1.72, skin: '#d9a57e', hair: '#5a5550', hairStyle: 'bald', mustache: '#5a5550',
    top: '#6b5a48', shirt: '#e9e2d0', pants: '#4a4038', shoes: '#2a2018',
    sitArms: { L: { x: -0.95, z: -0.28, f: -1.25 }, R: { x: -0.95, z: 0.28, f: -1.25 } },
  }));
  reader.paper = newspaper(tex.paper);
  reader.paper.position.set(0, 0.56, 0.4);
  reader.paper.rotation.x = -0.3;
  reader.hips.add(reader.paper);
  reader.headPitch = 0.25;

  const driver = (P.driver = new Person({
    id: 'driver', height: 1.7, skin: '#8a5a3c', hair: '#1c1a18', hairStyle: 'cap', hat: '#22324a',
    top: '#9cc3e6', pants: '#22324a', shortSleeves: true,
    sitArms: { L: { x: -1.0, z: -0.1, f: -0.7 }, R: { x: -1.0, z: 0.1, f: -0.7 } },
  }));

  const priya = (P.priya = new Person({
    id: 'priya', height: 1.64, skin: '#b07a52', hair: '#1a1210', hairStyle: 'bun', headset: true,
    top: '#1f9aa0', collar: '#17797e', pants: '#24262b', shoes: '#f0f0f0', shortSleeves: true,
    standArms: { L: { x: -0.35, z: 0.1, f: -1.5 }, R: { x: -0.1, z: -0.08, f: -0.5 } },
  }));
  priya.addLanyard('#f2c230');
  priya.tablet = tablet();
  priya.tablet.position.set(-0.03, -0.03, 0.09);
  priya.tablet.rotation.set(-1.1, 0.3, 0);
  priya.hold('L', priya.tablet);

  const greg = (P.greg = new Person({
    id: 'greg', height: 1.82, skin: '#e3b08c', hair: '#6a655e', hairStyle: 'cap', hat: '#3a4a38', mustache: '#6a655e',
    top: '#6f7780', pants: '#3d4148', shoes: '#3a2e22', wide: 1.15, deep: 1.15,
    standArms: { L: { x: 0, z: 0.08, f: -0.1 }, R: { x: -0.5, z: -0.1, f: -1.1 } },
  }));
  greg.addVest('#d6ee32');
  greg.broom = broom();
  greg.broom.position.set(0, 0.0, 0.02);
  greg.broom.rotation.set(1.25, 0, 0);
  greg.hold('R', greg.broom);

  for (const k in P) {
    P[k].group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }
  return P;
}
