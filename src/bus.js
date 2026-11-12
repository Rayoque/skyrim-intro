// The Lot F shuttle. Local frame: forward is -Z, right is +X, floor top at y = F.
import { THREE, Batch, lam, box, mesh, boxGeo, cylGeo, canvasTex, signTex, panel, tiledBox, rng, damp, clamp, FONT } from './util.js';

export const F = 0.42;
const WHITE = '#eceeea';
const TEAL = '#1f9aa0';
const WALL = '#d6dadd';
const FLOOR = '#3a3d42';
const CEIL = '#e6e9ec';
const BASE = '#2a2d33';
const POLE = '#f2c230';
const FRAME = '#2b2e33';

// Hip positions on the benches (bus-local) and which way each person faces.
export const SEAT = {
  you: { x: 0.95, z: 1.0 },
  dee: { x: -0.93, z: 1.0, yaw: Math.PI / 2 },
  toby: { x: -0.93, z: -0.3, yaw: Math.PI / 2 },
  rahul: { x: -0.93, z: 2.35, yaw: Math.PI / 2 },
  reader: { x: -0.93, z: -1.45, yaw: Math.PI / 2 },
  sleeper: { x: 0.93, z: 2.75, yaw: -Math.PI / 2 },
  driver: { x: -0.62, z: -2.98, yaw: Math.PI },
};

function fabricTex() {
  const r = rng(7);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#245f7a';
    g.fillRect(0, 0, w, h);
    const cols = ['#f2c230', '#e8587a', '#58c7b8', '#f08a3c', '#d9e6f0'];
    for (let i = 0; i < 46; i++) {
      g.save();
      g.translate(r() * w, r() * h);
      g.rotate(r() * 6.3);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      const s = 4 + r() * 9;
      if (r() > 0.5) g.fillRect(-s / 2, -1.5, s, 3);
      else {
        g.beginPath();
        g.moveTo(0, -s / 2);
        g.lineTo(s / 2, s / 2);
        g.lineTo(-s / 2, s / 2);
        g.fill();
      }
      g.restore();
    }
  }, { repeat: [1, 1] });
}

function ad(lines, bg, o) {
  return signTex(768, 180, bg, lines, o);
}

export class Bus {
  constructor() {
    const g = (this.group = new THREE.Group());
    g.rotation.order = 'YXZ';
    const body = (this.body = new THREE.Group());
    body.rotation.order = 'YXZ';
    g.add(body);
    const B = new Batch();

    // ---- shell ----
    B.box(2.5, 0.12, 8.0, FLOOR, 0, F - 0.06, 0);
    B.box(2.5, 0.22, 8.0, BASE, 0, F - 0.23, 0);
    const sideWall = (sx, len, zc) => {
      B.box(0.03, 0.86, len, WHITE, sx * 1.235, F + 0.43, zc);
      B.box(0.04, 0.86, len, WALL, sx * 1.2, F + 0.43, zc);
      B.box(0.012, 0.16, len, TEAL, sx * 1.254, F + 0.58, zc);
      B.box(0.03, 0.34, len, WHITE, sx * 1.235, F + 1.98, zc);
      B.box(0.04, 0.34, len, WALL, sx * 1.2, F + 1.98, zc);
    };
    sideWall(-1, 8.0, 0);
    sideWall(1, 6.5, 0.75);
    sideWall(1, 0.3, -3.85);
    B.box(0.07, 0.34, 1.2, WHITE, 1.215, F + 1.98, -3.1);
    for (const z of [-3.96, -2.6, -1.3, 0, 1.3, 2.6, 3.96]) B.box(0.075, 0.95, 0.09, FRAME, -1.215, F + 1.335, z);
    for (const z of [-3.96, -3.72, -2.48, -1.3, 0, 1.3, 2.6, 3.96]) B.box(0.075, 0.95, 0.09, FRAME, 1.215, F + 1.335, z);
    B.box(2.5, 0.09, 8.0, WHITE, 0, F + 2.195, 0);
    B.box(2.36, 0.02, 7.9, CEIL, 0, F + 2.14, 0);
    // front and rear
    B.box(2.5, 0.56, 0.07, WHITE, 0, F + 0.28, -3.965);
    B.box(2.5, 0.35, 0.07, WHITE, 0, F + 1.975, -3.965);
    B.box(2.5, 0.95, 0.07, WHITE, 0, F + 0.475, 3.965);
    B.box(2.5, 0.35, 0.07, WHITE, 0, F + 1.975, 3.965);
    for (const s of [1, -1]) {
      B.box(0.1, 1.24, 0.075, FRAME, s * 1.2, F + 1.18, -3.965);
      B.box(0.1, 0.9, 0.075, FRAME, s * 1.2, F + 1.4, 3.965);
      B.box(0.06, 0.32, 0.14, FRAME, s * 1.43, F + 1.5, -3.92);
      B.box(0.2, 0.03, 0.03, FRAME, s * 1.33, F + 1.6, -3.92);
    }
    B.box(2.54, 0.2, 0.12, BASE, 0, 0.36, -4.04);
    B.box(2.54, 0.2, 0.12, BASE, 0, 0.36, 4.04);
    for (const z of [-2.6, 2.5]) for (const s of [1, -1]) B.box(0.3, 0.5, 1.0, '#1b1c1f', s * 1.1, 0.45, z);

    // ---- interior ----
    B.box(0.46, 0.33, 5.0, BASE, -0.95, F + 0.165, 0.7);
    B.box(0.46, 0.33, 4.2, BASE, 0.95, F + 0.165, 1.1);
    B.box(1.4, 0.33, 0.46, BASE, 0, F + 0.165, 3.67);
    for (const s of [1, -1]) {
      for (const z of [0.35, 1.7, 3.1]) B.cyl(0.02, 0.02, 2.13, 8, POLE, s * 0.7, F + 1.065, z);
      B.cyl(0.015, 0.015, 6.4, 6, '#c9ccd0', s * 0.45, F + 1.95, 0.3, Math.PI / 2, 0, 0);
    }
    B.cyl(0.02, 0.02, 2.13, 8, POLE, 0.72, F + 1.065, -2.35);
    B.box(1.4, 0.006, 0.09, POLE, 0.15, F + 0.004, -2.4);
    // driver's corner
    B.box(1.05, 1.1, 0.05, FLOOR, -0.68, F + 0.55, -2.42);
    B.box(0.5, 0.1, 0.5, '#245f7a', -0.62, F + 0.36, -2.98);
    B.box(0.5, 0.62, 0.08, '#245f7a', -0.62, F + 0.72, -2.7);
    B.box(0.3, 0.3, 0.3, BASE, -0.62, F + 0.15, -2.98);
    B.box(2.3, 0.26, 0.42, BASE, 0, F + 0.43, -3.72);
    B.cyl(0.025, 0.025, 0.55, 6, FRAME, -0.62, F + 0.78, -3.52, -0.6, 0, 0);
    B.box(0.2, 0.26, 0.18, '#555a61', 0.62, F + 0.69, -3.6);
    const shell = B.build();
    shell.castShadow = true;
    body.add(shell);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 18), lam(FRAME));
    wheel.position.set(-0.62, F + 1.02, -3.36);
    wheel.rotation.x = -0.95;
    body.add(wheel);

    // seat cushions
    const fab = new THREE.MeshLambertMaterial({ map: fabricTex() });
    const cushion = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(tiledBox(w, h, d, 0.5), fab);
      m.position.set(x, y, z);
      body.add(m);
    };
    cushion(0.5, 0.09, 5.0, -0.95, F + 0.375, 0.7);
    cushion(0.09, 0.5, 5.0, -1.14, F + 0.68, 0.7);
    cushion(0.5, 0.09, 4.2, 0.95, F + 0.375, 1.1);
    cushion(0.09, 0.5, 4.2, 1.14, F + 0.68, 1.1);
    cushion(1.4, 0.09, 0.5, 0, F + 0.375, 3.67);
    cushion(1.4, 0.5, 0.09, 0, F + 0.68, 3.89);

    // lights
    const glow = new THREE.MeshBasicMaterial({ color: '#f6f9ff' });
    for (const z of [-1.5, 0.7, 2.9]) {
      const l = new THREE.Mesh(boxGeo(0.5, 0.02, 1.2), glow);
      l.position.set(0, F + 2.126, z);
      body.add(l);
    }
    this.lamp = new THREE.PointLight('#eaf2ff', 7, 7, 1.6);
    this.lamp.position.set(0, F + 1.95, 0.8);
    body.add(this.lamp);
    const head = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
    const tail = new THREE.MeshBasicMaterial({ color: '#d8262c' });
    for (const s of [1, -1]) {
      const h = new THREE.Mesh(boxGeo(0.3, 0.14, 0.03), head);
      h.position.set(s * 0.92, F + 0.22, -4.01);
      body.add(h);
      const tl = new THREE.Mesh(boxGeo(0.22, 0.14, 0.03), tail);
      tl.position.set(s * 0.98, F + 0.3, 4.01);
      body.add(tl);
    }

    // glass
    const glass = new THREE.MeshBasicMaterial({ color: '#cfe8ee', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const pane = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(boxGeo(w, h, d), glass);
      m.position.set(x, y, z);
      m.renderOrder = 5;
      body.add(m);
      return m;
    };
    pane(0.01, 0.95, 7.84, -1.23, F + 1.335, 0);
    pane(0.01, 0.95, 6.4, 1.23, F + 1.335, 0.72);
    pane(2.3, 1.24, 0.01, 0, F + 1.18, -3.97);
    pane(2.3, 0.85, 0.01, 0, F + 1.375, 3.97);
    pane(1.0, 0.75, 0.01, -0.68, F + 1.48, -2.42);

    // doors
    this.doors = [];
    for (const [z, dir] of [[-3.7, 1], [-2.5, -1]]) {
      const leaf = new THREE.Group();
      leaf.position.set(1.235, F, z);
      const fb = new Batch();
      fb.box(0.04, 0.06, 0.6, FRAME, 0, 0.03, dir * 0.3);
      fb.box(0.04, 0.06, 0.6, FRAME, 0, 1.92, dir * 0.3);
      fb.box(0.04, 1.95, 0.05, FRAME, 0, 0.975, dir * 0.025);
      fb.box(0.04, 1.95, 0.05, FRAME, 0, 0.975, dir * 0.575);
      fb.box(0.03, 0.5, 0.52, WHITE, 0, 0.3, dir * 0.3);
      leaf.add(fb.build());
      const gl = new THREE.Mesh(boxGeo(0.01, 1.35, 0.5), glass);
      gl.position.set(0, 1.22, dir * 0.3);
      gl.renderOrder = 5;
      leaf.add(gl);
      body.add(leaf);
      this.doors.push({ leaf, dir });
    }
    this.doorOpen = 0;
    this.doorTarget = 0;

    // signage
    const ads = [
      ad([{ t: 'SEE SOMETHING?', size: 62, y: 0.33, color: '#12383b' }, { t: 'CIRCLE BACK ABOUT IT.', size: 62, y: 0.7, color: '#12383b' }], '#f2c230'),
      ad([{ t: 'GEESE ARE NOT COWORKERS.', size: 60, y: 0.36 }, { t: 'Report incidents to Facilities, ext. 4', size: 34, y: 0.72, weight: 500, color: '#d8f3f0' }], '#17797e'),
      ad([{ t: 'YOUR BADGE IS YOUR FRIEND.', size: 54, y: 0.36, color: '#1c2b2d' }, { t: 'Wear it. Scan it. Do not lend it to birds.', size: 32, y: 0.72, weight: 500, color: '#3a4a4c' }], '#f4f1e8'),
      ad([{ t: 'LOT F', size: 76, y: 0.38, color: '#f2c230' }, { t: 'It builds character.', size: 38, y: 0.74, weight: 500, color: '#e9eef0' }], '#2a3440'),
      ad([{ t: 'SYNERGY: ON PAPER.', size: 60, y: 0.36, color: '#12383b' }, { t: 'Wexcombe Paper & Cloud', size: 34, y: 0.72, weight: 500, color: '#17797e' }], '#f4f1e8'),
    ];
    const place = (tex, x, z, ry) => {
      const p = panel(tex, 1.28, 0.3);
      p.position.set(x, F + 1.98, z);
      p.rotation.y = ry;
      body.add(p);
    };
    place(ads[0], -1.175, -0.7, Math.PI / 2);
    place(ads[1], -1.175, 0.95, Math.PI / 2);
    place(ads[2], -1.175, 2.6, Math.PI / 2);
    place(ads[3], 1.175, 0.3, -Math.PI / 2);
    place(ads[4], 1.175, 2.0, -Math.PI / 2);

    const liv = signTex(1024, 120, WHITE, [
      { t: 'WEXCOMBE PAPER & CLOUD', size: 62, y: 0.36, color: TEAL, align: 'left', x: 0.02 },
      { t: 'CAMPUS SHUTTLE  ·  LOT F  ⇄  BUILDING C', size: 32, y: 0.78, color: '#51606a', weight: 600, align: 'left', x: 0.02 },
    ]);
    for (const s of [1, -1]) {
      const p = panel(liv, 3.4, 0.4);
      p.position.set(s * 1.253, F + 0.26, 0.9);
      p.rotation.y = (s * Math.PI) / 2;
      body.add(p);
    }
    const dest = signTex(512, 96, '#101214', [{ t: 'LOT F ⇄ BLDG C', size: 60, y: 0.52, color: '#ffb52e' }]);
    const dp = panel(dest, 1.5, 0.26, { basic: true });
    dp.position.set(0, F + 1.98, -4.005);
    dp.rotation.y = Math.PI;
    body.add(dp);

    // scrolling LED inside, above the windshield
    this.ledC = document.createElement('canvas');
    this.ledC.width = 512;
    this.ledC.height = 64;
    this.ledG = this.ledC.getContext('2d');
    this.ledTex = new THREE.CanvasTexture(this.ledC);
    this.ledTex.colorSpace = THREE.SRGBColorSpace;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.2125), new THREE.MeshBasicMaterial({ map: this.ledTex }));
    led.position.set(0.1, F + 1.99, -3.925);
    body.add(led);
    this.ledText = 'NEXT STOP: BUILDING C   •   NEW HIRE ORIENTATION   •   SPEED BUMPS AHEAD: 10   •   PLEASE HOLD ON   •   ';
    this.ledX = 0;
    this.ledStatic = null;

    // hanging straps
    this.straps = [];
    for (const s of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        const st = new THREE.Group();
        st.position.set(s * 0.45, F + 1.94, -1.6 + i * 0.95);
        const sb = new Batch();
        sb.box(0.024, 0.2, 0.006, '#d6dadd', 0, -0.1, 0);
        sb.box(0.012, 0.012, 0.1, POLE, 0, -0.2, 0);
        sb.box(0.012, 0.09, 0.012, POLE, 0, -0.245, 0.045, 0.45, 0, 0);
        sb.box(0.012, 0.09, 0.012, POLE, 0, -0.245, -0.045, -0.45, 0, 0);
        st.add(sb.build());
        body.add(st);
        this.straps.push({ st, ph: i * 1.7 + s, x: 0, vx: 0, z: 0, vz: 0 });
      }
    }

    // wheels stay on the road while the body rides on its springs
    const W = new Batch();
    for (const z of [-2.6, 2.5]) {
      for (const s of [1, -1]) {
        W.cyl(0.4, 0.4, 0.28, 14, '#18191b', s * 1.1, 0.4, z, 0, 0, Math.PI / 2);
        W.cyl(0.2, 0.2, 0.3, 10, '#aeb4b8', s * 1.1, 0.4, z, 0, 0, Math.PI / 2);
      }
    }
    const wm = W.build();
    wm.castShadow = true;
    g.add(wm);

    // the player's own lap
    const lap = (this.lap = new THREE.Group());
    const LB = new Batch();
    const JEANS = '#24262c';
    const LEATHER = '#17181b';
    for (const s of [1, -1]) {
      LB.box(0.47, 0.13, 0.15, JEANS, 0.95 - 0.26, F + 0.49, 1.0 + s * 0.1);
      LB.box(0.12, 0.42, 0.12, JEANS, 0.95 - 0.47, F + 0.26, 1.0 + s * 0.1);
      LB.box(0.27, 0.085, 0.105, '#101012', 0.95 - 0.55, F + 0.045, 1.0 + s * 0.1);
      // jacket front panels and sleeves, hands in the pockets
      LB.box(0.2, 0.34, 0.17, LEATHER, 0.95 + 0.0, F + 0.7, 1.0 + s * 0.1);
      LB.box(0.1, 0.3, 0.1, LEATHER, 0.95 - 0.02, F + 0.74, 1.0 + s * 0.27, 0, 0, 0.5);
    }
    LB.box(0.012, 0.3, 0.012, '#b9bec4', 0.95 - 0.104, F + 0.7, 1.0);
    LB.box(0.25, 0.014, 0.34, '#e2c58a', 0.95 - 0.29, F + 0.566, 1.0, 0, 0.08, 0);
    lap.add(LB.build());
    const label = panel(
      signTex(256, 340, '#e2c58a', [
        { t: 'NEW HIRE', size: 44, y: 0.2, color: '#3b2f1c' },
        { t: 'PACKET', size: 44, y: 0.34, color: '#3b2f1c' },
        { t: 'Do not lose.', size: 24, y: 0.5, color: '#6a573a', weight: 500 },
        { t: 'Do not laminate.', size: 24, y: 0.59, color: '#6a573a', weight: 500 },
      ], {
        post: (c, w, h) => {
          c.fillStyle = '#f7e96a';
          c.save();
          c.translate(w * 0.64, h * 0.8);
          c.rotate(-0.12);
          c.fillRect(-55, -38, 110, 76);
          c.fillStyle = '#3b3a2a';
          c.font = `600 19px ${FONT}`;
          c.textAlign = 'center';
          c.fillText('see Priya', 0, -4);
          c.fillText('re: dots', 0, 20);
          c.restore();
        },
      }),
      0.25, 0.34
    );
    label.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.08);
    label.position.set(0.95 - 0.29, F + 0.5745, 1.0);
    lap.add(label);
    body.add(lap);

    this.sus = { y: 0, vy: 0, p: 0, vp: 0, r: 0, vr: 0 };
    this.pTarget = 0;
    this.rTarget = 0;
    this.drawLed(0);
  }

  drawLed(dt) {
    const g = this.ledG;
    g.fillStyle = '#0c0a08';
    g.fillRect(0, 0, 512, 64);
    g.font = `700 40px "Courier New", monospace`;
    g.textBaseline = 'middle';
    g.fillStyle = '#ffb52e';
    if (this.ledStatic) {
      g.textAlign = 'center';
      g.fillText(this.ledStatic, 256, 34);
    } else {
      g.textAlign = 'left';
      const w = g.measureText(this.ledText).width;
      this.ledX = (this.ledX + dt * 95) % w;
      g.fillText(this.ledText, -this.ledX, 34);
      g.fillText(this.ledText, -this.ledX + w, 34);
    }
    this.ledTex.needsUpdate = true;
  }
  kick(vy, vp) {
    this.sus.vy += vy;
    this.sus.vp += vp;
  }
  update(dt, t, moving = 1) {
    const s = this.sus;
    const h = Math.min(dt, 0.033);
    s.vy += (-110 * s.y - 9 * s.vy) * h;
    s.y += s.vy * h;
    s.vp += (-80 * (s.p - this.pTarget) - 8 * s.vp) * h;
    s.p += s.vp * h;
    s.vr += (-70 * (s.r - this.rTarget) - 8 * s.vr) * h;
    s.r += s.vr * h;
    const hum = moving * (Math.sin(t * 31) * 0.0012 + Math.sin(t * 7.3) * 0.004);
    this.body.position.y = s.y + hum;
    this.body.rotation.x = s.p + moving * Math.sin(t * 2.1) * 0.0025;
    this.body.rotation.z = s.r + moving * Math.sin(t * 1.7 + 1) * 0.004;

    for (const S of this.straps) {
      const ax = -s.vp * 0.9 + moving * Math.sin(t * 2.3 + S.ph) * 0.5;
      const az = -s.vr * 1.2 + moving * Math.sin(t * 1.9 + S.ph * 2) * 0.6 - this.rTarget * 30;
      S.vx += (ax - 14 * S.x - 1.6 * S.vx) * h;
      S.x += S.vx * h;
      S.vz += (az - 14 * S.z - 1.6 * S.vz) * h;
      S.z += S.vz * h;
      S.st.rotation.x = clamp(S.x, -0.6, 0.6);
      S.st.rotation.z = clamp(S.z, -0.6, 0.6);
    }
    this.doorOpen = damp(this.doorOpen, this.doorTarget, 5, dt);
    for (const D of this.doors) D.leaf.rotation.y = D.dir * this.doorOpen * 1.5;
    this._led = (this._led || 0) + dt;
    if (this._led > 0.033) {
      this.drawLed(this._led);
      this._led = 0;
    }
  }
}
