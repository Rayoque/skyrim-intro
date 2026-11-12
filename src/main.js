// Boot, main loop, and glue between the modules.
import { THREE, clamp, signTex, FONT } from './util.js';
import { Director } from './director.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { Bus, F } from './bus.js';
import { makeCast } from './people.js';
import { Goose } from './goose.js';
import { makePath, buildWorld, SPOT, PY } from './world.js';
import * as story from './story.js';

function paperTex() {
  return signTex(512, 360, '#e9e4d6', [
    { t: 'THE WEXCOMBE WEEKLY', size: 40, y: 0.1, color: '#1c1c1e', font: 'Georgia, "Times New Roman", serif' },
    { t: 'PAPER: STILL FLAT', size: 54, y: 0.3, color: '#1c1c1e', font: 'Georgia, "Times New Roman", serif' },
    { t: 'Cloud remains "up there," sources say', size: 22, y: 0.43, color: '#3a3a3c', weight: 500, font: 'Georgia, "Times New Roman", serif' },
  ], {
    pre: (g, w, h) => {
      g.fillStyle = '#1c1c1e';
      g.fillRect(20, h * 0.17, w - 40, 3);
      g.fillStyle = '#9a968c';
      for (let c = 0; c < 3; c++) for (let r = 0; r < 12; r++) g.fillRect(24 + c * 160, h * 0.52 + r * 13, 140 - (r % 4 === 3 ? 50 : 0), 5);
    },
  });
}

function boot() {
  const q = new URLSearchParams(location.search);
  const canvas = document.getElementById('c');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.querySelector('.lede').textContent = 'This browser could not start WebGL, so the shuttle cannot leave Lot F. Try another browser or device.';
    document.getElementById('startBtn').disabled = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 1200);

  const G = {
    THREE, renderer, scene, camera,
    dir: new Director(),
    snd: new Sound(),
    time: 0,
    speed: +q.get('speed') || 1,
    slow: 1,
    phase: 'title',
    auto: q.has('auto'),
    skipRide: q.has('skipride'),
    marks: [],
    stopAt: null,
    held: null,
    updaters: [],
    done: {},
    listeners: [],
    sayToken: 0,
    rideT: story.T0,
    riding: false,
    engineLevel: 0,
    outdoor: 0,
    busSpeed: 0,
    bumpCount: 6,
  };
  window.__game = G;
  G.mark = (name) => {
    G.marks.push(name);
    if (G.stopAt && G.stopAt.includes(name)) G.held = name;
  };
  G.toggleMute = () => {
    G.snd.setMuted(!G.snd.muted);
    G.ui.setMuteLabel(G.snd.muted);
  };
  G.input = new Input(canvas, G);
  G.ui = new UI(G);
  G.player = new Player(G);
  scene.add(G.player.rig);

  G.path = makePath();
  G.script = story.rideScript();
  G.kin = story.kinematics(G.script, G.path);
  G.world = buildWorld(G, G.path, { bumps: G.kin.bumps });
  G.bus = new Bus();
  scene.add(G.bus.group);
  G.cast = makeCast({ paper: paperTex() });
  G.gerald = new Goose();
  G.gerald.group.visible = false;
  scene.add(G.gerald.group);

  const T = (G.targets = {});
  const tgt = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  T.front = tgt(G.bus.body, 0.3, F + 1.2, -16);
  T.pond = tgt(scene, 26, 0.6, 78);
  T.plaza = tgt(scene, SPOT.greg[0], 1.6, SPOT.greg[1]);
  T.sky = tgt(scene, 44, 15, 128);
  T.group = tgt(scene, -22, 1.5, 138);
  T.road = tgt(scene, -3, 1.5, 118);

  const marker = (G.marker = new THREE.Group());
  const mm = new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 6, 28), mm);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), mm);
  cone.rotation.x = Math.PI;
  marker.add(ring, cone);
  marker.visible = false;
  scene.add(marker);

  story.stage(G);
  if (G.kin.startS < 5) console.warn('ride starts before the road does', G.kin.startS);

  // title shot: the plaza, before anyone arrives
  const pl = G.player;
  pl.rig.position.set(-7.4, PY + 1.45, 143.6);
  pl.yaw = 0.72;
  pl.pitch = 0.02;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 82 : w / h < 1.2 ? 74 : 66;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const step = (h) => {
    G.time += h;
    G.dir.update(h);
    story.rideUpdate(G, h);
    const rolling = G.riding ? clamp(G.busSpeed / G.kin.V0, 0, 1) : G.busAway ? 1 : 0;
    G.bus.update(h, G.time, rolling);
    for (const k in G.cast) G.cast[k].update(h, G.time);
    if (G.gerald.group.visible) G.gerald.update(h, G.time);
    if (G.phase === 'title') pl.yaw = 0.72 + Math.sin(G.time * 0.13) * 0.04;
    pl.update(h, G.time);
    for (const u of G.updaters) u(h, G.time);
    G.world.update(h, G.time);
    if (marker.visible) {
      cone.position.y = 2.15 + Math.sin(G.time * 4) * 0.08;
      cone.rotation.y = G.time * 2;
      ring.scale.setScalar(1 + Math.sin(G.time * 4) * 0.06);
    }
  };

  // test hooks: hold at a named beat, nudge one tiny step, carry on
  G.poke = () => step(1e-4);
  G.release = () => (G.held = null);

  const dbg = document.getElementById('dbg');
  const debug = q.has('debug');
  dbg.hidden = !debug;
  let last = performance.now();
  let fps = 60;
  const frame = async (now) => {
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.held) {
      const ff = G.input.ff && G.phase !== 'title' && G.phase !== 'end';
      const rem = real * G.speed * G.slow * (ff ? 6 : 1);
      const n = clamp(Math.ceil(rem / (1 / 30)), 1, 90);
      const h = rem / n;
      for (let i = 0; i < n; i++) {
        step(h);
        if (n > 1) await null;
      }
    }
    G.snd.setEngine(clamp(G.busSpeed / G.kin.V0, 0, 1.2), G.engineLevel);
    const fd = Math.hypot(pl.rig.position.x - SPOT.fountain[0], pl.rig.position.z - SPOT.fountain[1]);
    G.snd.setOutdoor(G.outdoor, G.outdoor * clamp(1.4 - fd / 70, 0, 1));
    G.snd.tick(real);
    G.ui.apply(real);
    renderer.render(scene, camera);
    if (debug) {
      fps += (1 / Math.max(real, 0.001) - fps) * 0.05;
      const p = camera.getWorldPosition(new THREE.Vector3());
      dbg.textContent = `${G.phase}  rideT ${G.rideT.toFixed(1)}/${G.kin.tEnd.toFixed(1)}  fps ${fps.toFixed(0)}\npos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  yaw ${pl.yaw.toFixed(2)} pitch ${pl.pitch.toFixed(2)}\ncalls ${renderer.info.render.calls} tris ${renderer.info.render.triangles}\n${G.marks.slice(-4).join(' > ')}`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) G.snd.suspend();
    else G.snd.resume();
  });

  const run = async () => {
    await story.intro(G);
    await story.ride(G);
    await story.arrive(G);
    await story.walkToQueue(G);
    await story.rollCall(G);
    await story.creator(G);
    await story.toDot(G);
    const fact = await story.icebreaker(G);
    await story.finale(G, fact);
  };
  G.ui.el.startBtn.addEventListener('click', async () => {
    if (G.phase !== 'title') return;
    G.phase = 'starting';
    G.snd.init();
    G.snd.resume();
    G.snd.click();
    G.ui.el.start.hidden = true;
    canvas.focus();
    await G.dir.to(G.ui, { fade: 1 }, 0.9);
    run().catch((e) => {
      console.error(e);
      G.error = String((e && e.stack) || e);
    });
  });
}

boot();
