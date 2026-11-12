// Shared helpers. three.js is loaded as a global by the page.
export const THREE = window.THREE;
export const TAU = Math.PI * 2;

export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const dampAngle = (cur, target, lambda, dt) => cur + angDiff(cur, target) * (1 - Math.exp(-lambda * dt));

export const ease = {
  lin: (k) => k,
  io: (k) => k * k * (3 - 2 * k),
  in: (k) => k * k * k,
  out: (k) => 1 - (1 - k) ** 3,
  back: (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2,
};

// Small deterministic PRNG so the campus is the same on every load.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mats = new Map();
export function lam(color, o) {
  const key = color + (o ? JSON.stringify(o) : '');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...o });
    mats.set(key, m);
  }
  return m;
}

const geos = new Map();
function geo(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
export const boxGeo = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylGeo = (rt, rb, h, seg = 10) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sphGeo = (r, ws = 14, hs = 10) => geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const capGeo = (r, len) => geo(`k${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));

export function mesh(g, color, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(g, typeof color === 'object' && color.isMaterial ? color : lam(color, o));
  m.position.set(x, y, z);
  return m;
}
export const box = (w, h, d, color, x, y, z, o) => mesh(boxGeo(w, h, d), color, x, y, z, { flatShading: true, ...o });

// Merges many primitives into one vertex-coloured mesh (one draw call).
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
export class Batch {
  constructor() {
    this.pos = [];
    this.col = [];
  }
  addGeo(g0, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    return this.addGeoM(g0, color, _m);
  }
  addGeoM(g0, color, matrix) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position;
    _c.set(color);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      this.col.push(_c.r, _c.g, _c.b);
    }
    if (g !== g0) g.dispose();
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) {
    return this.addGeo(boxGeo(w, h, d), color, x, y, z, rx, ry, rz);
  }
  cyl(rt, rb, h, seg, color, x, y, z, rx, ry, rz) {
    return this.addGeo(cylGeo(rt, rb, h, seg), color, x, y, z, rx, ry, rz);
  }
  sph(r, color, x, y, z, sx = 1, sy = 1, sz = 1) {
    return this.addGeo(sphGeo(1, 10, 7), color, x, y, z, 0, 0, 0, r * sx, r * sy, r * sz);
  }
  // Bakes every mesh under `root` (in root-local space) into this batch.
  bake(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const m = new THREE.Matrix4();
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (let a = o; a && a !== root.parent; a = a.parent) if (!a.visible) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      this.addGeoM(o.geometry, o.material.color, m);
    });
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
  build(o = {}) {
    return new THREE.Mesh(this.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, ...o }));
  }
}

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 4;
  if (o.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(o.repeat[0], o.repeat[1]);
  }
  return t;
}

export const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// Text sign texture. lines: [{ t, size, color, y (0..1), weight, align }]
export function signTex(w, h, bg, lines, o = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (o.border) {
      g.strokeStyle = o.border;
      g.lineWidth = o.borderW || 8;
      g.strokeRect(g.lineWidth / 2 + 4, g.lineWidth / 2 + 4, w - g.lineWidth - 8, h - g.lineWidth - 8);
    }
    if (o.pre) o.pre(g, w, h);
    for (const l of lines) {
      let size = l.size || 40;
      g.font = `${l.weight || 700} ${size}px ${l.font || FONT}`;
      const max = w * (l.maxW || 0.9);
      const tw = g.measureText(l.t).width;
      if (tw > max) {
        size = Math.floor((size * max) / tw);
        g.font = `${l.weight || 700} ${size}px ${l.font || FONT}`;
      }
      g.fillStyle = l.color || '#fff';
      g.textAlign = l.align || 'center';
      g.textBaseline = 'middle';
      const x = l.align === 'left' ? w * (l.x ?? 0.06) : l.align === 'right' ? w * (l.x ?? 0.94) : w * (l.x ?? 0.5);
      g.fillText(l.t, x, h * l.y);
    }
    if (o.post) o.post(g, w, h);
  }, o);
}

// A flat textured panel. Lit by default so it sits in the scene.
export function panel(tex, w, h, o = {}) {
  const M = o.basic ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const mat = new M({ map: tex, transparent: !!o.transparent });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  if (o.double) {
    const back = new THREE.Mesh(m.geometry, mat);
    back.rotation.y = Math.PI;
    m.add(back);
  }
  return m;
}

export function shadowAll(root, cast = true, receive = false) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return root;
}

// Rescales a BoxGeometry's UVs so a repeating texture keeps one tile per `tile` metres.
export function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return g;
}
