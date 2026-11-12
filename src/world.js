// The Wexcombe Paper & Cloud campus. +x is east, +z is south.
import { THREE, Batch, lam, box, mesh, boxGeo, cylGeo, sphGeo, canvasTex, signTex, panel, rng, clamp, lerp, FONT } from './util.js';
import { gooseBlueprint } from './goose.js';

export const SUN = new THREE.Vector3(1, 0.3, 0.35).normalize();
export const FOG = '#dccdc0';
export const PY = 0.15; // plaza and sidewalk height

export const SPOT = {
  stop: { x: -2.3, z: 136 },
  table: [-22.4, 150],
  tent: [-24, 150],
  priya: [-23.35, 150],
  queue: [[-20.9, 150], [-19.55, 150.12], [-18.2, 149.9], [-16.8, 150.55]],
  dots: [
    [-23.6, 136.4], [-23.6, 138], [-23.6, 139.6],
    [-22, 136.4], [-22, 138], [-22, 139.6],
    [-20.4, 136.4], [-20.4, 138], [-20.4, 139.6],
  ],
  carpet: [-28, 138],
  cocktail: [-26.4, 138],
  priyaIce: [-27.4, 135.7],
  greg: [-10.4, 136.6],
  gooseSign: [-8.7, 137.5],
  pond: [46, 112, 36, 84],
  fountain: [40, 138],
};

export function makePath() {
  const pts = [
    [-6, -490], [-8, -440], [-6, -385], [-8, -330], [-25, -285], [-55, -245], [-70, -200], [-62, -155], [-35, -115],
    [-10, -75], [5, -30], [4, 15], [0, 60], [0, 100], [0, 140], [0, 200], [0, 260], [0, 330],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 3000;
  curve.updateArcLengths();
  const L = curve.getLength();
  const sAtZ = (z) => {
    for (let i = 0; i <= 3000; i++) if (curve.getPointAt(i / 3000).z >= z) return (i / 3000) * L;
    return L;
  };
  const sStop = sAtZ(SPOT.stop.z);
  const sWake = sAtZ(-374);
  const frame = (s) => {
    const u = clamp(s / L, 0, 1);
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    return { p, t, r: new THREE.Vector3(-t.z, 0, t.x), yaw: Math.atan2(-t.x, -t.z) };
  };
  return { curve, L, sStop, sWake, frame };
}

function ribbon(path, s0, s1, step, a, ya, b, yb, vLen) {
  const pos = [];
  const uv = [];
  const idx = [];
  let n = 0;
  for (let s = s0; s <= s1 + 0.001; s += step, n++) {
    const f = path.frame(s);
    pos.push(f.p.x + f.r.x * a, ya, f.p.z + f.r.z * a, f.p.x + f.r.x * b, yb, f.p.z + f.r.z * b);
    uv.push(0, s / vLen, 1, s / vLen);
    if (n > 0) {
      const i = n * 2;
      idx.push(i - 2, i, i - 1, i - 1, i, i + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const speckle = (g, w, h, n, cols, r) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    const s = 1 + r() * 2.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
};

export function buildWorld(G, path, sched) {
  const scene = G.scene;
  const R = rng(20261112);
  const W = { anim: [], props: {} };
  const flat = (y, mat, geo) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    return m;
  };
  const off = (m, f = -2) => {
    m.polygonOffset = true;
    m.polygonOffsetFactor = f;
    m.polygonOffsetUnits = f;
    return m;
  };

  // ---- sky and light -----------------------------------------------------
  scene.fog = new THREE.FogExp2(FOG, 0.0062);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { sunDir: { value: SUN } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
        void main(){
          vec3 d = normalize(vDir);
          vec3 hor = vec3(0.863,0.804,0.753);
          vec3 top = vec3(0.47,0.63,0.84);
          float h = smoothstep(0.0, 0.75, d.y);
          vec3 col = mix(hor, top, pow(h, 0.62));
          float s = max(dot(d, sunDir), 0.0);
          col = mix(col, vec3(1.0,0.74,0.50), pow(s, 5.0) * 0.8 * (1.0 - h * 0.7));
          col += vec3(1.0,0.86,0.62) * pow(s, 120.0) * 0.55;
          col += vec3(1.0,0.97,0.9) * smoothstep(0.9993, 0.9997, s);
          col = mix(hor, col, smoothstep(-0.04, 0.03, d.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  W.sky = sky;

  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const x = 40 + r() * 176;
      const y = 44 + r() * 40;
      const rad = 22 + r() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,236,222,0.5)');
      gr.addColorStop(1, 'rgba(255,236,222,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  });
  const clouds = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.75, color: i % 3 === 0 ? '#ffd9c2' : '#fff1e6' }));
    const a = R() * Math.PI * 2;
    const d = 380 + R() * 320;
    sp.position.set(Math.cos(a) * d, 110 + R() * 130, Math.sin(a) * d);
    sp.scale.set(260 + R() * 220, 60 + R() * 50, 1);
    clouds.add(sp);
  }
  scene.add(clouds);
  W.clouds = clouds;

  const hemi = new THREE.HemisphereLight('#d3e2f6', '#8c9070', 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd6ae', 2.7);
  sun.target.position.set(-20, 0, 141);
  sun.position.copy(sun.target.position).addScaledVector(SUN, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -34;
  sc.right = 34;
  sc.top = 34;
  sc.bottom = -34;
  sc.near = 20;
  sc.far = 260;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  W.sun = sun;
  W.hemi = hemi;

  // ---- ground ------------------------------------------------------------
  const lawnTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#84a565';
    g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,220,0.045)' : 'rgba(0,40,0,0.05)';
      g.fillRect(0, (i * h) / 8, w, h / 8);
    }
    speckle(g, w, h, 2600, ['#7a9c5c', '#8fb06f', '#789a5a', '#93b274'], r);
  }, { repeat: [110, 110] });
  const lawn = flat(0, new THREE.MeshLambertMaterial({ map: lawnTex }), new THREE.PlaneGeometry(1500, 1500));
  lawn.position.set(0, 0, -80);
  lawn.receiveShadow = true;
  scene.add(lawn);

  const roadTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#484a50';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2200, ['#3f4146', '#52545a', '#45474c'], rng(4));
    g.fillStyle = '#e9e6dc';
    g.fillRect(8, 0, 5, h);
    g.fillRect(w - 13, 0, 5, h);
    g.fillStyle = '#e7b730';
    g.fillRect(w / 2 - 6, 0, 4, h);
    g.fillRect(w / 2 + 2, 0, 4, h);
  }, { repeat: [1, 1] });
  const road = new THREE.Mesh(ribbon(path, 0, path.L, 3, -3.75, 0.03, 3.75, 0.03, 7.5), off(new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })));
  road.receiveShadow = true;
  scene.add(road);
  const walkTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#c9c3b8';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 200, ['#c2bcb0', '#d0cabf'], rng(6));
    g.fillStyle = '#aaa498';
    g.fillRect(0, 0, w, 2);
  }, { repeat: [1, 1] });
  const walkMat = off(new THREE.MeshLambertMaterial({ map: walkTex, side: THREE.DoubleSide }), -1);
  const curbMat = new THREE.MeshLambertMaterial({ color: '#a8a296', side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const sw = new THREE.Mesh(ribbon(path, 0, path.L, 3, s * 3.75, PY, s * 6.25, PY, 2), walkMat);
    sw.receiveShadow = true;
    scene.add(sw);
    scene.add(new THREE.Mesh(ribbon(path, 0, path.L, 3, s * 3.75, 0, s * 3.75, PY, 2), curbMat));
  }

  // speed bumps, placed where the script says the shuttle will hit them
  const bumpTex = canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#e7b730';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2a2c';
    for (let x = -32; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 16, h);
      g.lineTo(x + 32, 0);
      g.lineTo(x + 16, 0);
      g.fill();
    }
  });
  const bumpMat = new THREE.MeshLambertMaterial({ map: bumpTex });
  for (const b of sched.bumps) {
    const f = path.frame(b.s);
    const m = new THREE.Mesh(boxGeo(7.5, 0.1, 0.75), bumpMat);
    m.position.set(f.p.x, 0.06, f.p.z);
    m.rotation.y = f.yaw;
    scene.add(m);
    const handmade = b.n > 10;
    const tex = handmade
      ? canvasTex(256, 256, (g, w, h) => {
          g.fillStyle = '#b98f55';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#2a2018';
          g.font = `700 54px "Comic Sans MS", "Marker Felt", ${FONT}`;
          g.textAlign = 'center';
          g.save();
          g.translate(w / 2, h / 2);
          g.rotate(-0.05);
          g.fillText('NEW', 0, -44);
          g.fillText('BUMP', 0, 16);
          g.font = `600 34px "Comic Sans MS", "Marker Felt", ${FONT}`;
          g.fillText('- Greg', 30, 74);
          g.restore();
        })
      : signTex(256, 256, '#f2c230', [
          { t: 'SPEED', size: 54, y: 0.24, color: '#1c1c1e' },
          { t: 'BUMP', size: 54, y: 0.47, color: '#1c1c1e' },
          { t: `${b.n} OF 10`, size: 40, y: 0.76, color: '#1c1c1e', weight: 600 },
        ], { border: '#1c1c1e' });
    const sg = new THREE.Group();
    const p = panel(tex, 0.9, 0.9, { double: true });
    p.position.y = handmade ? 1.2 : 1.75;
    sg.add(p, box(0.06, handmade ? 1.3 : 2.0, 0.06, handmade ? '#8a6a3a' : '#7d8388', 0, handmade ? 0.6 : 1.0, -0.04));
    const n = f.t.clone().multiplyScalar(-0.8).addScaledVector(f.r, 0.6).normalize();
    sg.position.set(f.p.x - f.r.x * 7.4 - f.t.x * 1.5, 0, f.p.z - f.r.z * 7.4 - f.t.z * 1.5);
    sg.rotation.y = Math.atan2(n.x, n.z);
    scene.add(sg);
  }

  // ---- Lot F -------------------------------------------------------------
  const LOT = { x0: 8, x1: 188, z0: -490, z1: -338 };
  const lotTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4d4f55';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, ['#44464b', '#56585e'], rng(8));
    g.fillStyle = '#d9d6cc';
    const rowH = (h * 10) / 17;
    for (let i = 0; i <= 2; i++) g.fillRect((i * w) / 2 - 2, 0, 4, rowH);
    g.fillRect(0, rowH / 2 - 2, w, 4);
  }, { repeat: [(LOT.x1 - LOT.x0) / 5.2, (LOT.z1 - LOT.z0) / 17] });
  const lot = flat(0.02, off(new THREE.MeshLambertMaterial({ map: lotTex })), new THREE.PlaneGeometry(LOT.x1 - LOT.x0, LOT.z1 - LOT.z0));
  lot.position.set((LOT.x0 + LOT.x1) / 2, 0.02, (LOT.z0 + LOT.z1) / 2);
  scene.add(lot);
  const hedge = new Batch();
  hedge.box(1.3, 0.95, LOT.z1 - LOT.z0, '#5f8450', LOT.x0 - 2.2, 0.47, (LOT.z0 + LOT.z1) / 2);
  hedge.box(LOT.x1 - LOT.x0 + 4, 0.95, 1.3, '#5f8450', (LOT.x0 + LOT.x1) / 2, 0.47, LOT.z1 + 2.2);
  scene.add(hedge.build());

  // cars
  const carB = new Batch();
  carB.box(1.78, 0.56, 4.3, '#ffffff', 0, 0.56, 0);
  carB.box(1.8, 0.2, 4.34, '#b9b9b9', 0, 0.3, 0);
  for (const z of [-1.35, 1.35]) for (const s of [1, -1]) carB.cyl(0.32, 0.32, 0.22, 10, '#1d1d1f', s * 0.82, 0.32, z, 0, 0, Math.PI / 2);
  const carT = new Batch();
  carT.box(1.6, 0.5, 2.15, '#2f3d4a', 0, 1.08, -0.2);
  carT.box(1.62, 0.06, 2.0, '#ffffff', 0, 1.34, -0.2);
  const cars = [];
  const paints = ['#e8e8e6', '#c9ccd0', '#2e3238', '#8d949b', '#3b5f8a', '#9b2f33', '#d9cfb8', '#4a6a58', '#f1f1ef', '#5a5e66'];
  let row = 0;
  for (let z = LOT.z0 + 2.5; z < LOT.z1 - 8; z += 17, row++) {
    for (const [dz, face] of [[0, 0], [5, Math.PI]]) {
      for (let x = LOT.x0 + 1.3; x < LOT.x1 - 1; x += 2.6) {
        const far = (x - LOT.x0) / (LOT.x1 - LOT.x0);
        if (R() > 0.86 - far * 0.35) continue;
        cars.push({ x, z: z + dz + (R() - 0.5) * 0.5, ry: face + (R() - 0.5) * 0.06, c: paints[Math.floor(R() * paints.length)], s: 0.92 + R() * 0.16 });
      }
    }
  }
  const dummy = new THREE.Object3D();
  const carBody = new THREE.InstancedMesh(carB.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), cars.length);
  const carTop = new THREE.InstancedMesh(carT.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), cars.length);
  const col = new THREE.Color();
  cars.forEach((c, i) => {
    dummy.position.set(c.x, 0.02, c.z);
    dummy.rotation.set(0, c.ry, 0);
    dummy.scale.set(c.s, c.s, c.s);
    dummy.updateMatrix();
    carBody.setMatrixAt(i, dummy.matrix);
    carTop.setMatrixAt(i, dummy.matrix);
    carBody.setColorAt(i, col.set(c.c));
    carTop.setColorAt(i, col.set(c.c));
  });
  scene.add(carBody, carTop);

  // ---- trees and lamps ---------------------------------------------------
  const samples = [];
  for (let s = 0; s <= path.L; s += 4) samples.push(path.frame(s).p);
  const roadDist = (x, z) => {
    let d = 1e9;
    for (const p of samples) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2);
    return Math.sqrt(d);
  };
  const rects = [
    [LOT.x0 - 4, LOT.x1 + 4, LOT.z0 - 4, LOT.z1 + 5],
    [-27, 27, -254, -216], // A
    [-40, 4, -177, -143], // commons
    [24, 72, -96, -44], // D
    [-130, -86, -241, -169], // parking structure
    [-73, -31, -79, -25], // B
    [-70, -5, 106, 176], // C + plaza
    [-48, -32, -244, -228], // sculpture
  ];
  const [pcx, pcz, prx, prz] = SPOT.pond;
  const blocked = (x, z, pad = 0) => {
    for (const r of rects) if (x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad) return true;
    if (((x - pcx) / (prx + 5 + pad)) ** 2 + ((z - pcz) / (prz + 5 + pad)) ** 2 < 1) return true;
    return false;
  };
  const trees = [];
  for (let s = 20; s < path.L - 10; s += 13) {
    const f = path.frame(s);
    for (const side of [1, -1]) {
      if (R() < 0.18) continue;
      const d = 8.6 + R() * 3.2;
      const x = f.p.x + f.r.x * d * side + (R() - 0.5) * 2;
      const z = f.p.z + f.r.z * d * side + (R() - 0.5) * 2;
      if (blocked(x, z, 1) || roadDist(x, z) < 7.8) continue;
      trees.push({ x, z, h: 5.5 + R() * 3.5 });
    }
  }
  for (let i = 0; i < 520; i++) {
    const x = -190 + R() * 420;
    const z = -520 + R() * 760;
    if (blocked(x, z, 3) || roadDist(x, z) < 13) continue;
    trees.push({ x, z, h: 6 + R() * 6 });
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6), lam('#6a5240', { flatShading: true }), trees.length);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ flatShading: true }), trees.length * 2);
  const greens = ['#6f9a55', '#7aa65c', '#86ad62', '#5f8c50', '#93b56a', '#a3b85e'];
  trees.forEach((t, i) => {
    const th = t.h * 0.42;
    dummy.position.set(t.x, th / 2, t.z);
    dummy.rotation.set(0, R() * 6, 0);
    dummy.scale.set(1 + t.h * 0.06, th, 1 + t.h * 0.06);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    const r = t.h * 0.3;
    dummy.position.set(t.x, th + r * 0.9, t.z);
    dummy.scale.set(r, r * 1.2, r);
    dummy.updateMatrix();
    leaves.setMatrixAt(i * 2, dummy.matrix);
    col.set(greens[Math.floor(R() * greens.length)]);
    leaves.setColorAt(i * 2, col);
    dummy.position.set(t.x + (R() - 0.5) * r, th + r * 1.75, t.z + (R() - 0.5) * r);
    dummy.scale.set(r * 0.68, r * 0.7, r * 0.68);
    dummy.updateMatrix();
    leaves.setMatrixAt(i * 2 + 1, dummy.matrix);
    col.offsetHSL(0, 0, 0.04);
    leaves.setColorAt(i * 2 + 1, col);
  });
  scene.add(trunk, leaves);

  const lamps = [];
  for (let x = LOT.x0 + 17; x < LOT.x1; x += 34) for (let z = LOT.z0 + 11; z < LOT.z1; z += 34) lamps.push({ x, z, h: 9, ry: 0 });
  for (let s = 30, k = 0; s < path.L - 20; s += 29, k++) {
    const f = path.frame(s);
    const side = k % 2 ? 1 : -1;
    const x = f.p.x + f.r.x * 6.9 * side;
    const z = f.p.z + f.r.z * 6.9 * side;
    if (x < -6 && x > -40 && z > 117 && z < 165) continue;
    lamps.push({ x, z, h: 6.2, ry: Math.atan2(-f.r.x * side, -f.r.z * side) });
  }
  const lampB = new Batch();
  lampB.cyl(0.07, 0.1, 1, 6, '#5c636a', 0, 0.5, 0);
  const lampPole = new THREE.InstancedMesh(lampB.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), lamps.length);
  const lampHead = new THREE.InstancedMesh(boxGeo(0.5, 0.14, 1.1), new THREE.MeshBasicMaterial({ color: '#ffe2b0' }), lamps.length);
  const haloPos = [];
  lamps.forEach((l, i) => {
    dummy.position.set(l.x, 0, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, l.h, 1);
    dummy.updateMatrix();
    lampPole.setMatrixAt(i, dummy.matrix);
    dummy.position.set(l.x + Math.sin(l.ry) * 0.45, l.h, l.z + Math.cos(l.ry) * 0.45);
    dummy.rotation.set(0, l.ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampHead.setMatrixAt(i, dummy.matrix);
    haloPos.push(l.x + Math.sin(l.ry) * 0.45, l.h - 0.1, l.z + Math.cos(l.ry) * 0.45);
  });
  scene.add(lampPole, lampHead);
  const haloTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,150,0.85)');
    gr.addColorStop(0.35, 'rgba(255,196,120,0.3)');
    gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPos, 3));
  scene.add(new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: haloTex, size: 5.5, transparent: true, depthWrite: false, sizeAttenuation: true })));

  // ---- buildings ---------------------------------------------------------
  const winTex = (seed, glassA, glassB, wall) =>
    canvasTex(256, 256, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = wall;
      g.fillRect(0, 0, w, h);
      for (let fy = 0; fy < 4; fy++) {
        for (let bx = 0; bx < 4; bx++) {
          const lit = r() < 0.14;
          g.fillStyle = lit ? '#ffdf9a' : r() < 0.5 ? glassA : glassB;
          g.fillRect(bx * 64 + 5, fy * 64 + 8, 54, 38);
          if (!lit) {
            g.fillStyle = 'rgba(255,255,255,0.10)';
            g.fillRect(bx * 64 + 5, fy * 64 + 8, 54, 12);
          }
        }
      }
    }, { repeat: [1 / 12.8, 1 / 14.4] });
  const facades = [winTex(11, '#5f8ea8', '#6c9ab3', '#c9c4ba'), winTex(12, '#4f7f93', '#5b8b9f', '#8a8f96'), winTex(13, '#6a94a6', '#7ba3b3', '#e2ddd2')];
  const building = (cx, cz, w, d, h, style = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, uv.getX(f * 4 + i) * dims[f][0], uv.getY(f * 4 + i) * dims[f][1]);
    const side = new THREE.MeshLambertMaterial({ map: facades[style] });
    const roof = lam('#8f9296');
    const m = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
    m.position.set(cx, h / 2, cz);
    scene.add(m);
    const cap = box(w + 0.6, 0.5, d + 0.6, '#b9b5ac', cx, h + 0.25, cz);
    scene.add(cap);
    return m;
  };
  building(0, -235, 46, 30, 14.4, 0); // A
  building(-18, -160, 36, 26, 7.2, 2); // commons
  building(48, -70, 40, 44, 18, 0); // D
  building(-52, -52, 34, 46, 25.2, 1); // B
  const bc = building(-53, 141, 26, 62, 21.6, 1); // C
  bc.castShadow = false;
  building(120, 60, 50, 70, 14.4, 2);
  building(-150, 40, 60, 40, 18, 0);

  const ps = new Batch();
  for (let lv = 0; lv < 4; lv++) {
    ps.box(36, 0.5, 64, '#b3ada2', -108, 0.25 + lv * 3.3, -205);
    ps.box(36.4, 1.0, 0.3, '#c6c0b4', -108, 1.0 + lv * 3.3, -173);
    ps.box(36.4, 1.0, 0.3, '#c6c0b4', -108, 1.0 + lv * 3.3, -237);
    ps.box(0.3, 1.0, 64.4, '#c6c0b4', -90, 1.0 + lv * 3.3, -205);
  }
  for (let z = -235; z <= -175; z += 10) for (const x of [-90.3, -108, -125.7]) ps.box(0.7, 13.2, 0.7, '#9d978c', x, 6.6, z);
  scene.add(ps.build());

  const wt = new Batch();
  wt.cyl(7, 7, 7, 14, '#dfe4e6', 120, 31, -150);
  wt.cyl(1, 7, 3, 14, '#c9d0d3', 120, 36, -150);
  wt.cyl(7, 3, 3, 14, '#c9d0d3', 120, 26, -150);
  wt.cyl(0.8, 0.8, 26, 8, '#b5bbbe', 120, 13, -150);
  for (let i = 0; i < 6; i++) wt.cyl(0.3, 0.3, 27, 6, '#aab0b3', 120 + Math.cos(i * 1.047) * 6.2, 13.5, -150 + Math.sin(i * 1.047) * 6.2);
  wt.box(14.2, 2.2, 0.3, '#1f9aa0', 120, 31, -143);
  scene.add(wt.build());

  // ---- wayfinding --------------------------------------------------------
  const monument = (x, z, ry, tex, w = 3.6, h = 1.5) => {
    const g = new THREE.Group();
    g.add(box(w + 0.3, 0.35, 0.5, '#8d877c', 0, 0.17, 0));
    const p = panel(tex, w, h, { double: true });
    p.position.y = 0.35 + h / 2;
    g.add(p, box(w, h, 0.16, '#3a4046', 0, 0.35 + h / 2, -0.09));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
  };
  const TEALD = '#17797e';
  monument(-2.6, -349, 2.6, signTex(512, 220, TEALD, [
    { t: 'LOT F', size: 96, y: 0.36 },
    { t: 'OVERFLOW  ·  VISITORS  ·  NEW HIRES', size: 26, y: 0.78, weight: 600, color: '#d8f3f0' },
  ]));
  monument(-33.5, -262, 2.25, signTex(512, 220, TEALD, [
    { t: 'BUILDING A', size: 64, y: 0.34 },
    { t: 'INTEGRITY', size: 34, y: 0.72, weight: 600, color: '#f2c230' },
  ]));
  monument(-50, -132, 1.9, signTex(512, 220, TEALD, [
    { t: 'THE COMMONS', size: 58, y: 0.34 },
    { t: 'Soup today: also soup', size: 30, y: 0.72, weight: 500, color: '#d8f3f0' },
  ]), 3.2, 1.35);
  monument(-12.5, -50, 4.2, signTex(512, 220, TEALD, [
    { t: 'BUILDING B', size: 64, y: 0.34 },
    { t: 'AGILITY (ELEVATOR OUT)', size: 30, y: 0.72, weight: 600, color: '#f2c230' },
  ]));
  const post = (x, z, ry, tex, w, h, y = 1.6) => {
    const g = new THREE.Group();
    const p = panel(tex, w, h, { double: true });
    p.position.y = y;
    g.add(p, box(0.06, y + h / 2, 0.06, '#7d8388', 0, (y + h / 2) / 2, -0.04));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
  };
  post(-12, -303, 2.3, signTex(256, 256, '#f4f1e8', [
    { t: 'WELLNESS', size: 40, y: 0.22, color: TEALD },
    { t: 'TRAIL', size: 40, y: 0.42, color: TEALD },
    { t: 'CLOSED', size: 44, y: 0.7, color: '#b23a48' },
    { t: '(geese)', size: 24, y: 0.88, color: '#51606a', weight: 500 },
  ], { border: TEALD }), 1.0, 1.0);
  const noFeed = signTex(256, 256, '#f4f1e8', [
    { t: 'DO NOT', size: 44, y: 0.2, color: '#b23a48' },
    { t: 'FEED', size: 44, y: 0.4, color: '#b23a48' },
    { t: 'THE GEESE', size: 40, y: 0.6, color: '#b23a48' },
    { t: 'They remember.', size: 24, y: 0.84, color: '#3a4046', weight: 500 },
  ], { border: '#b23a48' });
  post(7.2, 34, 2.4, noFeed, 0.9, 0.9);
  post(7.2, 96, 2.4, noFeed, 0.9, 0.9);
  post(7.2, 152, 1.3, noFeed, 0.9, 0.9);
  // value banners on lamp posts near the end of the ride
  const values = ['INTEGRITY', 'SYNERGY', 'PAPER', 'CLOUD', 'HUSTLE', 'BALANCE'];
  values.forEach((v, i) => {
    const s = path.sStop - 150 + i * 29;
    const f = path.frame(s);
    const tex = canvasTex(96, 256, (g, w, h) => {
      g.fillStyle = i % 2 ? '#f2c230' : '#1f9aa0';
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-Math.PI / 2);
      g.fillStyle = i % 2 ? '#12383b' : '#ffffff';
      g.font = `700 44px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(v, 0, 2);
      g.restore();
    });
    const p = panel(tex, 0.75, 2.0, { double: true });
    p.position.set(f.p.x - f.r.x * 7.4, 4.2, f.p.z - f.r.z * 7.4);
    p.rotation.y = f.yaw + Math.PI / 2;
    scene.add(p);
    scene.add(box(0.1, 5.4, 0.1, '#5c636a', f.p.x - f.r.x * 7.85, 2.7, f.p.z - f.r.z * 7.85));
  });

  // corporate art
  const art = new THREE.Group();
  const corten = lam('#b5673a', { flatShading: true });
  const t1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.42, 6, 20, Math.PI * 1.55), corten);
  t1.position.y = 3.3;
  t1.rotation.set(0, 0.3, 0.5);
  const t2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.38, 6, 18, Math.PI * 1.5), lam('#d9dde0', { flatShading: true }));
  t2.position.set(1.2, 2.6, 0.4);
  t2.rotation.set(1.3, 0.2, 2.2);
  art.add(t1, t2, box(5, 0.3, 3, '#9b958a', 0, 0.15, 0));
  art.position.set(-40, 0, -236);
  scene.add(art);
  post(-45.5, -241, 2.2, signTex(256, 160, '#3a4046', [
    { t: '"SYNERGY (II)"', size: 30, y: 0.3 },
    { t: 'Please do not ask', size: 22, y: 0.6, weight: 500, color: '#c9d0d3' },
    { t: 'what it means.', size: 22, y: 0.8, weight: 500, color: '#c9d0d3' },
  ]), 0.8, 0.5, 0.9);

  // ---- pond --------------------------------------------------------------
  const disc = new THREE.CircleGeometry(1, 56);
  const shore = flat(0.012, off(lam('#b7a888')), disc);
  shore.scale.set(prx + 2.2, prz + 2.2, 1);
  shore.position.set(pcx, 0.012, pcz);
  const waterMat = off(new THREE.MeshLambertMaterial({ color: '#86b3c4', emissive: '#2c4650' }), -3);
  const water = flat(0.03, waterMat, disc);
  water.scale.set(prx, prz, 1);
  water.position.set(pcx, 0.03, pcz);
  const glintTex = canvasTex(256, 256, (g, w, h) => {
    const r = rng(21);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      g.fillStyle = `rgba(255,${226 + Math.floor(r() * 25)},${180 + Math.floor(r() * 50)},${0.15 + r() * 0.5})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 9, 1 + r() * 1.5);
    }
  }, { repeat: [9, 20] });
  const glint = flat(0.05, off(new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, depthWrite: false, opacity: 0.55 }), -4), disc);
  glint.scale.set(prx - 0.5, prz - 0.5, 1);
  glint.position.set(pcx, 0.05, pcz);
  scene.add(shore, water, glint);
  W.anim.push((dt, t) => {
    glintTex.offset.x = t * 0.012;
    glintTex.offset.y = Math.sin(t * 0.35) * 0.02;
    glint.material.opacity = 0.42 + Math.sin(t * 1.3) * 0.1;
  });
  const reeds = [];
  for (let i = 0; i < 260; i++) {
    const a = Math.PI * (0.62 + R() * 0.76);
    const k = 1.0 + R() * 0.045;
    reeds.push({ x: pcx + Math.cos(a) * prx * k, z: pcz + Math.sin(a) * prz * k, h: 0.7 + R() * 0.9 });
  }
  const reedM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 1, 4), lam('#7d8f4e', { flatShading: true }), reeds.length);
  reeds.forEach((r, i) => {
    dummy.position.set(r.x, r.h / 2, r.z);
    dummy.rotation.set((R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3);
    dummy.scale.set(1, r.h, 1);
    dummy.updateMatrix();
    reedM.setMatrixAt(i, dummy.matrix);
  });
  scene.add(reedM);

  // fountain
  const [fx, fz] = SPOT.fountain;
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.55, 6, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }));
  jet.position.set(fx, 3, fz);
  scene.add(jet, box(1.6, 0.3, 1.6, '#8d877c', fx, 0.15, fz));
  const NF = 150;
  const fpos = new Float32Array(NF * 3);
  const fseed = [];
  for (let i = 0; i < NF; i++) fseed.push([R() * Math.PI * 2, 0.4 + R() * 1.6, R()]);
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const spray = new THREE.Points(fgeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.32, transparent: true, opacity: 0.7, depthWrite: false }));
  spray.frustumCulled = false;
  scene.add(spray);
  W.anim.push((dt, t) => {
    for (let i = 0; i < NF; i++) {
      const [a, sp, o] = fseed[i];
      const k = (t * 0.48 + o) % 1;
      const tt = k * 2.1;
      fpos[i * 3] = fx + Math.cos(a) * sp * tt;
      fpos[i * 3 + 1] = Math.max(0.05, 10.6 * tt - 4.9 * tt * tt * 1.03 + 0.4);
      fpos[i * 3 + 2] = fz + Math.sin(a) * sp * tt;
    }
    fgeo.attributes.position.needsUpdate = true;
    jet.scale.x = jet.scale.z = 1 + Math.sin(t * 9) * 0.06;
  });

  // the flock
  const gb = new Batch().bake(gooseBlueprint());
  const flock = [];
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2;
    const k = 0.2 + R() * 0.62;
    flock.push({ x: pcx + Math.cos(a) * prx * k * 0.8 - 6, z: pcz + Math.sin(a) * prz * k, ry: R() * 6.3, ph: R() * 6 });
  }
  const flockM = new THREE.InstancedMesh(gb.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), flock.length);
  flockM.frustumCulled = false;
  scene.add(flockM);
  W.anim.push((dt, t) => {
    flock.forEach((f, i) => {
      dummy.position.set(f.x + Math.sin(t * 0.11 + f.ph) * 1.5, 0.03 + Math.sin(t * 1.4 + f.ph) * 0.012, f.z + Math.cos(t * 0.09 + f.ph) * 1.5);
      dummy.rotation.set(0, f.ry + Math.sin(t * 0.13 + f.ph) * 0.6, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      flockM.setMatrixAt(i, dummy.matrix);
    });
    flockM.instanceMatrix.needsUpdate = true;
  });

  // a far-off V of geese
  const vee = new THREE.Group();
  const birdMat = new THREE.MeshBasicMaterial({ color: '#3b3a3c', side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(1.1, 0.42);
  wingGeo.translate(0.55, 0, 0);
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const k = Math.ceil(i / 2);
    b.position.set((i % 2 ? 1 : -1) * k * 2.6, Math.sin(i) * 0.5, -k * 2.8);
    const wl = new THREE.Mesh(wingGeo, birdMat);
    wl.rotation.x = -Math.PI / 2;
    const wr = new THREE.Mesh(wingGeo, birdMat);
    wr.rotation.x = -Math.PI / 2;
    wr.scale.x = -1;
    const pl = new THREE.Group();
    const pr = new THREE.Group();
    pl.add(wl);
    pr.add(wr);
    b.add(pl, pr, new THREE.Mesh(boxGeo(0.22, 0.2, 1.3), birdMat));
    vee.add(b);
    birds.push({ pl, pr, ph: i * 0.8 });
  }
  scene.add(vee);
  W.vee = vee;
  W.veeOrbit = { cx: 30, cz: 60, r: 210, y: 62, speed: 0.045, a: 2.4 };
  W.anim.push((dt, t) => {
    const o = W.veeOrbit;
    o.a += dt * o.speed;
    vee.position.set(o.cx + Math.cos(o.a) * o.r, o.y, o.cz + Math.sin(o.a) * o.r);
    vee.rotation.y = -o.a;
    for (const b of birds) {
      const f = Math.sin(t * 5.2 + b.ph) * 0.55;
      b.pl.rotation.z = f;
      b.pr.rotation.z = -f;
    }
  });

  // ---- plaza -------------------------------------------------------------
  const P = { x0: -40, x1: -6.25, z0: 118, z1: 164 };
  const paveTex = canvasTex(256, 256, (g, w, h) => {
    const r = rng(31);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 196 + Math.floor(r() * 22);
        g.fillStyle = `rgb(${v + 6},${v},${v - 9})`;
        g.fillRect(x * 64, y * 64, 64, 64);
      }
    }
    g.strokeStyle = 'rgba(120,112,100,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, h);
      g.moveTo(0, i * 64);
      g.lineTo(w, i * 64);
      g.stroke();
    }
    speckle(g, w, h, 700, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.07)'], r);
  }, { repeat: [(P.x1 - P.x0) / 3.2, (P.z1 - P.z0) / 3.2] });
  const plaza = flat(PY, off(new THREE.MeshLambertMaterial({ map: paveTex })), new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0));
  plaza.position.set((P.x0 + P.x1) / 2, PY, (P.z0 + P.z1) / 2);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const edge = new Batch();
  edge.box(P.x1 - P.x0, PY, 0.3, '#a8a296', (P.x0 + P.x1) / 2, PY / 2, P.z0 - 0.15);
  edge.box(P.x1 - P.x0, PY, 0.3, '#a8a296', (P.x0 + P.x1) / 2, PY / 2, P.z1 + 0.15);
  // planters and benches
  for (const z of [P.z0 + 1.2, P.z1 - 1.2]) {
    for (let x = P.x0 + 4; x < P.x1 - 2; x += 7.5) {
      edge.box(3.2, 0.6, 1.2, '#8d877c', x, PY + 0.3, z);
      for (let i = 0; i < 3; i++) edge.sph(0.62, i % 2 ? '#6f9a55' : '#86ad62', x - 1 + i, PY + 0.85, z, 1, 0.8, 0.9);
    }
  }
  for (const [x, z] of [[-14, 126], [-22, 126], [-30, 126], [-14, 159], [-30, 159]]) {
    edge.box(2.0, 0.08, 0.55, '#8a6a4a', x, PY + 0.46, z);
    for (const s of [1, -1]) edge.box(0.08, 0.46, 0.5, '#5c636a', x + s * 0.8, PY + 0.23, z);
  }
  // bus stop
  edge.box(0.08, 2.6, 0.08, '#5c636a', -4.3, PY + 1.3, 131.2);
  for (const s of [1, -1]) edge.box(0.08, 2.4, 0.08, '#5c636a', -5.9, PY + 1.2, 128.4 + s * 1.5);
  edge.box(1.5, 0.08, 3.4, '#1f9aa0', -5.4, PY + 2.44, 128.4);
  edge.box(0.4, 0.07, 2.6, '#8a6a4a', -5.75, PY + 0.48, 128.4);
  // flagpoles
  for (const z of [121.5, 123.6, 125.7]) edge.cyl(0.06, 0.09, 9, 8, '#c9ccd0', -8.2, PY + 4.5, z);
  // banner posts
  for (const z of [143.1, 150.9]) edge.cyl(0.06, 0.06, 3.9, 8, '#c9ccd0', -13.2, PY + 1.95, z);
  const edgeM = edge.build();
  edgeM.castShadow = true;
  edgeM.receiveShadow = true;
  scene.add(edgeM);

  const stopSign = panel(signTex(256, 256, '#1f9aa0', [
    { t: 'CAMPUS', size: 40, y: 0.2 },
    { t: 'LOOP', size: 40, y: 0.4 },
    { t: 'Bldg C', size: 44, y: 0.66, color: '#f2c230' },
    { t: 'every 11 min (approx.)', size: 20, y: 0.88, weight: 500 },
  ]), 0.7, 0.7, { double: true });
  stopSign.position.set(-4.3, PY + 2.3, 131.2);
  stopSign.rotation.y = Math.PI / 2;
  scene.add(stopSign);

  // flags
  const flags = [];
  ['#1f9aa0', '#f2c230', '#f4f1e8'].forEach((c, i) => {
    const geo = new THREE.PlaneGeometry(2.4, 1.5, 10, 4);
    geo.translate(1.2, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(-8.2, PY + 8.1, 121.5 + i * 2.1);
    m.rotation.y = 2.6;
    m.castShadow = true;
    scene.add(m);
    flags.push({ geo, base: geo.attributes.position.array.slice(), ph: i * 1.3 });
  });
  W.anim.push((dt, t) => {
    for (const f of flags) {
      const p = f.geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = f.base[i * 3];
        p.setZ(i, Math.sin(x * 2.6 - t * 4.2 + f.ph) * 0.16 * (x / 2.4));
        p.setY(i, f.base[i * 3 + 1] - (x / 2.4) * 0.25 + Math.sin(x * 1.7 - t * 3 + f.ph) * 0.05 * (x / 2.4));
      }
      p.needsUpdate = true;
    }
  });

  // banner over the walk
  const banner = panel(signTex(1024, 128, '#f2c230', [{ t: 'DAY ONE STARTS TODAY', size: 84, y: 0.54, color: '#12383b' }], { border: '#12383b', borderW: 6 }), 7.6, 0.95, { double: true });
  banner.position.set(-13.2, PY + 3.35, 147);
  banner.rotation.y = Math.PI / 2;
  banner.castShadow = true;
  scene.add(banner);

  // check-in tent
  const [tx, tz] = SPOT.tent;
  const tent = new Batch();
  for (const sx of [1, -1]) for (const sz of [1, -1]) tent.box(0.06, 2.35, 0.06, '#c9ccd0', tx + sx * 1.75, PY + 1.175, tz + sz * 1.75);
  tent.addGeo(new THREE.ConeGeometry(2.62, 1.0, 4), '#f6f4ee', tx, PY + 2.85, tz, 0, Math.PI / 4, 0);
  for (const sz of [1, -1]) tent.box(3.6, 0.36, 0.04, '#1f9aa0', tx, PY + 2.2, tz + sz * 1.78);
  tent.box(0.04, 0.36, 3.6, '#1f9aa0', tx - 1.78, PY + 2.2, tz);
  const tentM = tent.build();
  tentM.castShadow = true;
  scene.add(tentM);
  const welcome = panel(signTex(1024, 104, '#1f9aa0', [{ t: 'WELCOME  ·  NEW HIRE CHECK-IN  ·  WELCOME', size: 62, y: 0.54 }]), 3.6, 0.366, { double: true });
  welcome.position.set(tx + 1.79, PY + 2.2, tz);
  welcome.rotation.y = Math.PI / 2;
  scene.add(welcome);

  // check-in table
  const [bx, bz] = SPOT.table;
  const tb = new Batch();
  tb.box(0.75, 0.04, 1.85, '#e9e5da', bx, PY + 0.74, bz);
  tb.box(0.02, 0.5, 1.85, '#1f9aa0', bx + 0.37, PY + 0.48, bz);
  for (const sz of [1, -1]) for (const sx of [1, -1]) tb.box(0.04, 0.72, 0.04, '#7d8388', bx + sx * 0.3, PY + 0.36, bz + sz * 0.8);
  for (let i = 0; i < 4; i++) tb.box(0.32, 0.03, 0.34, i % 2 ? '#f1ead8' : '#e6dfcc', bx - 0.1, PY + 0.775 + i * 0.03, bz - 0.6);
  tb.cyl(0.11, 0.11, 0.3, 10, '#aeb4b8', bx - 0.12, PY + 0.91, bz + 0.68);
  tb.cyl(0.03, 0.03, 0.1, 6, '#2a2c30', bx + 0.02, PY + 0.82, bz + 0.68);
  tb.box(0.36, 0.05, 0.26, '#f08aa6', bx + 0.1, PY + 0.785, bz + 0.25);
  for (let i = 0; i < 5; i++) tb.box(0.012, 0.012, 0.22, ['#1f9aa0', '#f2c230', '#b23a48', '#3b5f8a', '#6f9a55'][i], bx + 0.02 + i * 0.03, PY + 0.77, bz - 0.15);
  const tbM = tb.build();
  tbM.castShadow = true;
  tbM.receiveShadow = true;
  scene.add(tbM);
  const checkin = panel(signTex(512, 128, '#f4f1e8', [{ t: 'CHECK-IN', size: 62, y: 0.38, color: '#17797e' }, { t: 'Badge. Tote. Dot.', size: 30, y: 0.78, color: '#3a4046', weight: 500 }]), 1.3, 0.33);
  checkin.position.set(bx + 0.385, PY + 0.48, bz);
  checkin.rotation.y = Math.PI / 2;
  scene.add(checkin);

  // balloons
  const balloons = new THREE.Group();
  const bcols = ['#1f9aa0', '#f2c230', '#f6f4ee'];
  const clusters = [[tx + 1.75, tz + 1.75], [tx + 1.75, tz - 1.75], [-13.2, 143.1], [-13.2, 150.9]];
  clusters.forEach(([x, z], ci) => {
    const c = new THREE.Group();
    c.position.set(x, PY + (ci < 2 ? 2.2 : 3.9), z);
    for (let i = 0; i < 3; i++) {
      const b = mesh(sphGeo(0.17, 12, 9), bcols[(i + ci) % 3], (i - 1) * 0.2, 0.75 + (i % 2) * 0.22, (i % 2) * 0.12);
      b.scale.y = 1.2;
      b.castShadow = true;
      c.add(b, box(0.006, 0.7 + (i % 2) * 0.2, 0.006, '#d9d9d9', (i - 1) * 0.1, 0.33, 0));
    }
    balloons.add(c);
  });
  scene.add(balloons);
  W.balloons = balloons;
  W.balloonKick = 0;
  W.anim.push((dt, t) => {
    W.balloonKick = Math.max(0, W.balloonKick - dt * 0.7);
    balloons.children.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 1.1 + i) * (0.08 + W.balloonKick * 0.5);
      c.rotation.x = Math.cos(t * 0.9 + i * 2) * (0.06 + W.balloonKick * 0.4);
    });
  });

  // decals: dots, tape, carpet
  const decal = (tex, w, d, x, z, y = PY + 0.012, ry = 0) => {
    const m = flat(y, off(new THREE.MeshLambertMaterial({ map: tex, transparent: true }), -4), new THREE.PlaneGeometry(w, d));
    m.position.set(x, y, z);
    m.rotation.z = ry;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const dotTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#1f9aa0';
    g.beginPath();
    g.arc(64, 64, 60, 0, 7);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(64, 64, 48, 0, 7);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = `700 30px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DOT', 64, 66);
  });
  W.dotMeshes = SPOT.dots.map(([x, z]) => decal(dotTex, 0.62, 0.62, x, z, PY + 0.012, Math.PI / 2));
  const tapeTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#f2c230';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(14, 14);
    g.lineTo(114, 114);
    g.moveTo(114, 14);
    g.lineTo(14, 114);
    g.stroke();
  });
  decal(tapeTex, 0.6, 0.6, SPOT.queue[0][0], SPOT.queue[0][1]);
  const carpetTex = canvasTex(256, 256, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = '#6a2f86';
    g.fillRect(0, 0, w, h);
    const cs = ['#f08a3c', '#f2c230', '#e8587a', '#58c7b8'];
    for (let i = 0; i < 26; i++) {
      g.fillStyle = cs[i % 4];
      g.beginPath();
      g.arc(r() * w, r() * h, 8 + r() * 26, 0, 7);
      g.fill();
    }
    g.strokeStyle = '#f2c230';
    g.lineWidth = 12;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
  const [cx, cz] = SPOT.carpet;
  const carpet = new THREE.Mesh(boxGeo(1.8, 0.03, 1.8), new THREE.MeshLambertMaterial({ map: carpetTex }));
  carpet.position.set(cx, PY + 0.015, cz);
  carpet.receiveShadow = true;
  scene.add(carpet);
  const cs = post(cx - 0.3, cz - 1.45, Math.PI / 2 - 0.5, signTex(256, 200, '#6a2f86', [
    { t: 'SHARING', size: 46, y: 0.24, color: '#f2c230' },
    { t: 'CARPET', size: 46, y: 0.5, color: '#f2c230' },
    { t: 'One voice at a time.', size: 22, y: 0.8, weight: 500 },
  ]), 0.62, 0.48, 1.05);
  cs.traverse((o) => o.isMesh && (o.castShadow = true));

  // cocktail table in front of the carpet, with things on it
  const [kx, kz] = SPOT.cocktail;
  const kt = new Batch();
  kt.cyl(0.4, 0.4, 0.035, 18, '#e9e5da', kx, PY + 1.06, kz);
  kt.cyl(0.4, 0.2, 1.02, 14, '#1f9aa0', kx, PY + 0.53, kz);
  kt.cyl(0.3, 0.3, 0.03, 14, '#5c636a', kx, PY + 0.015, kz);
  const ktM = kt.build();
  ktM.castShadow = true;
  scene.add(ktM);
  const items = [];
  const item = (m, dx, dz) => {
    m.position.set(kx + dx, PY + 1.08 + (m.userData.h || 0.03), kz + dz);
    m.castShadow = true;
    scene.add(m);
    items.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), live: false });
    return m;
  };
  const bell = new THREE.Group();
  bell.add(mesh(sphGeo(0.05, 10, 6), '#d8b24a', 0, 0, 0), mesh(cylGeo(0.055, 0.055, 0.012, 10), '#2a2c30', 0, -0.03, 0), mesh(cylGeo(0.008, 0.008, 0.03, 6), '#2a2c30', 0, 0.055, 0));
  bell.userData.h = 0.036;
  item(bell, -0.2, -0.16);
  const jar = new THREE.Group();
  jar.add(mesh(cylGeo(0.07, 0.07, 0.17, 12), new THREE.MeshLambertMaterial({ color: '#dff0f2', transparent: true, opacity: 0.55 }), 0, 0, 0));
  jar.add(panel(signTex(128, 64, '#f4f1e8', [{ t: 'FUN FACTS', size: 24, y: 0.52, color: '#17797e' }]), 0.11, 0.055));
  jar.children[1].position.z = 0.072;
  jar.children[1].rotation.y = 0;
  jar.userData.h = 0.085;
  item(jar, 0.14, -0.08);
  for (let i = 0; i < 9; i++) {
    const slip = box(0.07, 0.004, 0.035, i % 2 ? '#f7e96a' : '#f6c6d6', 0, 0, 0);
    slip.userData.h = 0.004 + i * 0.0005;
    slip.rotation.y = R() * 3;
    item(slip, -0.05 + (R() - 0.5) * 0.3, 0.12 + (R() - 0.5) * 0.2);
  }
  const mints = new THREE.Group();
  mints.add(mesh(cylGeo(0.075, 0.05, 0.04, 12), '#f4f1e8', 0, 0, 0));
  for (let i = 0; i < 5; i++) mints.add(mesh(sphGeo(0.016, 6, 5), i % 2 ? '#e8587a' : '#ffffff', Math.cos(i * 1.3) * 0.03, 0.022, Math.sin(i * 1.3) * 0.03));
  mints.userData.h = 0.022;
  item(mints, 0.02, 0.2);
  W.props.items = items;
  W.scatter = () => {
    for (const it of items) {
      it.live = true;
      const a = Math.atan2(it.m.position.z - kz, it.m.position.x - kx) + (R() - 0.5);
      const sp = 1.6 + R() * 2.6;
      it.v.set(Math.cos(a) * sp, 2.2 + R() * 2.6, Math.sin(a) * sp);
      it.w.set((R() - 0.5) * 14, (R() - 0.5) * 14, (R() - 0.5) * 14);
    }
  };
  W.anim.push((dt) => {
    for (const it of items) {
      if (!it.live) continue;
      it.v.y -= 9.8 * dt;
      it.m.position.addScaledVector(it.v, dt);
      it.m.rotation.x += it.w.x * dt;
      it.m.rotation.y += it.w.y * dt;
      it.m.rotation.z += it.w.z * dt;
      const floor = PY + 0.03;
      if (it.m.position.y < floor) {
        it.m.position.y = floor;
        if (Math.abs(it.v.y) < 0.8) {
          it.live = false;
        } else {
          it.v.y *= -0.35;
          it.v.x *= 0.6;
          it.v.z *= 0.6;
          it.w.multiplyScalar(0.5);
        }
      }
    }
  });

  // goose incident board
  const [gx, gz] = SPOT.gooseSign;
  const gsC = document.createElement('canvas');
  gsC.width = 512;
  gsC.height = 400;
  const gsT = new THREE.CanvasTexture(gsC);
  gsT.colorSpace = THREE.SRGBColorSpace;
  gsT.anisotropy = 4;
  W.setGooseDays = (n) => {
    const g = gsC.getContext('2d');
    g.fillStyle = '#f7f6f1';
    g.fillRect(0, 0, 512, 400);
    g.strokeStyle = '#3a4046';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 500, 388);
    g.fillStyle = '#2a2f33';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 44px ${FONT}`;
    g.fillText('DAYS SINCE LAST', 256, 56);
    g.fillStyle = '#b23a48';
    g.fillText('GOOSE INCIDENT', 256, 108);
    g.fillStyle = '#f2c230';
    g.fillRect(176, 142, 160, 170);
    g.strokeStyle = '#2a2f33';
    g.lineWidth = 6;
    g.strokeRect(176, 142, 160, 170);
    g.fillStyle = '#1c1c1e';
    g.font = `700 150px ${FONT}`;
    g.fillText(String(n), 256, 234);
    g.font = `500 28px ${FONT}`;
    g.fillStyle = '#51606a';
    g.fillText('Campus record: 4', 256, 352);
    gsT.needsUpdate = true;
  };
  W.setGooseDays(3);
  const gs = new THREE.Group();
  const gp = panel(gsT, 1.3, 1.02);
  gp.position.y = 1.25;
  gp.rotation.x = -0.1;
  gs.add(gp);
  const back = box(1.36, 1.08, 0.04, '#3a4046', 0, 1.25, -0.03);
  back.rotation.x = -0.1;
  gs.add(back);
  for (const s of [1, -1]) {
    const leg = box(0.05, 1.8, 0.05, '#8a6a4a', s * 0.55, 0.88, -0.06);
    leg.rotation.x = -0.1;
    const leg2 = box(0.05, 1.5, 0.05, '#8a6a4a', s * 0.55, 0.72, -0.42);
    leg2.rotation.x = 0.28;
    gs.add(leg, leg2);
  }
  gs.position.set(gx, PY, gz);
  gs.rotation.y = Math.atan2(-4.4 - gx, 140.6 - gz);
  gs.traverse((o) => o.isMesh && (o.castShadow = true));
  scene.add(gs);
  W.gooseSign = gs;

  // Building C entrance
  const en = new Batch();
  en.box(5, 0.35, 11, '#3a4046', -42.5, PY + 3.6, 141);
  for (const s of [1, -1]) en.cyl(0.18, 0.18, 3.5, 10, '#c9ccd0', -40.6, PY + 1.75, 141 + s * 4.6);
  en.cyl(1.5, 1.5, 3.2, 16, '#31424c', -40, PY + 1.6, 141);
  en.box(0.2, 3.3, 9, '#22303a', -39.95, PY + 1.65, 141);
  const enM = en.build();
  enM.castShadow = true;
  scene.add(enM);
  const cSign = panel(signTex(512, 512, '#f2c230', [{ t: 'C', size: 400, y: 0.54, color: '#12383b' }]), 3.2, 3.2);
  cSign.position.set(-39.95, PY + 8, 141);
  cSign.rotation.y = Math.PI / 2;
  scene.add(cSign);
  const vc = panel(signTex(1024, 96, '#3a4046', [{ t: 'VISITOR CENTER  ·  NEW HIRE ORIENTATION  ·  THE GOOD VENDING MACHINE', size: 44, y: 0.54 }]), 10.6, 1.0);
  vc.position.set(-39.98, PY + 4.45, 141);
  vc.rotation.y = Math.PI / 2;
  scene.add(vc);

  W.plaza = P;
  W.update = (dt, t) => {
    for (const f of W.anim) f(dt, t);
    sky.position.copy(G.camera.getWorldPosition(sky.position));
    clouds.position.set(sky.position.x, 0, sky.position.z);
  };
  return W;
}
