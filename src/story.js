// The script: who says what, when the shuttle bumps, and where everyone walks.
import { THREE, lerp, clamp, smooth, damp, angDiff, ease, canvasTex } from './util.js';
import { F, SEAT } from './bus.js';
import { SPOT, PY } from './world.js';
import { tote } from './people.js';
import { DEPTS, badgeName } from './badge.js';

export const T0 = -13.4; // ride clock when the screen is still black

const WHO = {
  dee: { name: 'Dee', color: '#f0b6d4', voice: { f: 310, type: 'triangle' } },
  toby: { name: 'Toby', color: '#a9d6ff', voice: { f: 400, type: 'square', v: 0.5 } },
  rahul: { name: 'Rahul', color: '#c6ced6', voice: { f: 165, type: 'sawtooth', v: 0.6 } },
  driver: { name: 'Driver', color: '#f5d77a', voice: { f: 150, type: 'square', pa: true } },
  priya: { name: 'Priya', color: '#86e6d8', voice: { f: 440, type: 'triangle' } },
  greg: { name: 'Greg', color: '#e3ea6e', voice: { f: 118, type: 'sawtooth', v: 0.7 } },
  you: { name: 'You', color: '#ffffff', voice: { f: 250, type: 'sine' } },
};

const sayDur = (text) => Math.max(1.25, 0.75 + text.length * 0.047);

// ---- the ride, as data ----------------------------------------------------
export function rideScript() {
  const S = [];
  const say = (who, text, o = {}) => S.push({ k: 'say', who, text, ...o });
  const wait = (d) => S.push({ k: 'wait', d });
  const cue = (name, d = 0, o = {}) => S.push({ k: 'cue', name, d, ...o });

  wait(0.7);
  say('dee', "Oh, good. You're up.", { to: 'you' });
  say('dee', 'You slept through all of Lot F. Best way to see it, honestly.', { to: 'you' });
  wait(0.5);
  say('dee', "It's eleven minutes from Lot F to Building C. Nine of them are speed bumps.", { to: 'you' });
  cue('bump', 0.75, { n: 7 });
  say('toby', 'Seven.', { to: 'lap', dur: 1.3 });
  say('dee', "He's counting them.", { to: 'you' });
  say('toby', "There are ten. It's in the handbook. Page forty.", { to: 'dee' });
  say('dee', 'He read the handbook.', { to: 'you' });
  say('toby', 'Twice.', { to: 'you', dur: 1.3 });
  wait(0.7);
  say('dee', 'Is that a leather jacket? At a paper company. Bold.', { to: 'you' });
  say('toby', 'Sorry. Have we met? You look like somebody who gives keynotes.', { to: 'you' });
  say('dee', "That's a new hire, Tobias. We're all new hires.", { to: 'toby' });
  wait(0.6);
  say('dee', 'First day?', { to: 'you', dur: 1.5 });
  wait(1.2);
  say('dee', "Mine too. Thirty-one years here, and it's my first day.", { to: 'you' });
  say('rahul', 'HR migration.');
  say('dee', 'Now the computer says I start today. In Lot F. With a welcome packet.', { to: 'you' });
  cue('bump', 0.75, { n: 8 });
  say('toby', 'Eight.', { to: 'lap', dur: 1.3 });
  say('dee', 'I own a stapler older than him.', { to: 'you' });
  say('toby', 'Is it a good stapler?', { to: 'dee' });
  say('dee', "It's the last good stapler.", { to: 'toby' });
  wait(0.8);
  say('toby', 'What about you? Which department?', { to: 'rahul' });
  say('rahul', "Don't know yet. This is my fifth orientation.");
  say('toby', 'Your fifth?', { to: 'rahul', dur: 1.4 });
  say('rahul', "Can't start without a laptop. Can't order a laptop until I've started.");
  say('rahul', 'IT blames the chip shortage. Says one company makes all the good ones.');
  cue('glance', 1.5);
  say('rahul', 'So every Monday they send me back to Lot F.');
  say('rahul', 'I have a favorite seat.');
  cue('bump', 0.75, { n: 9 });
  say('toby', 'Nine.', { to: 'lap', dur: 1.3 });
  wait(0.5);
  say('toby', 'Is it true about the fourth floor?', { to: 'dee' });
  say('dee', "Nobody's been up to four since the merger.", { to: 'toby' });
  say('rahul', "I've been. It's just printers.");
  wait(0.9);
  say('rahul', "They're all on.", { dur: 1.7 });
  wait(1.0);
  cue('bump', 0.75, { n: 10 });
  say('toby', "Ten. That's all of them.", { to: 'dee' });
  say('dee', "And there's the pond. Eyes front, both of you.", { to: 'pond' });
  say('toby', 'Why? It looks nice.', { to: 'pond' });
  say('dee', "That's how it gets you.", { to: 'toby' });
  cue('goose', 12.0);
  cue('pa', 0.9);
  say('driver', 'Thank you for your patience. Building C is next.');
  say('driver', 'Please gather your belongings, your welcome packet, and your composure.');
  cue('bump', 0.75, { n: 11 });
  say('toby', 'Eleven?', { to: 'dee', dur: 1.4 });
  say('toby', "That's not in the handbook.", { to: 'dee' });
  say('dee', "That one's new. Greg poured it himself.", { to: 'toby' });
  say('toby', "Who's Greg?", { to: 'dee', dur: 1.4 });
  say('dee', 'Facilities. Him, with the broom. He watches the pond so the rest of us can work.', { to: 'plaza' });
  say('dee', "And that's Priya. People Ops. I have never once seen her blink.", { to: 'plaza' });
  wait(0.6);

  let t = 0;
  for (const s of S) {
    s.t = t;
    s.dur = s.k === 'say' ? s.dur ?? sayDur(s.text) : s.d;
    t += s.dur + (s.k === 'say' ? s.gap ?? 0.35 : 0);
  }
  return { steps: S, end: t };
}

// Shuttle speed and distance as pure functions of the ride clock, so speed
// bumps and the goose crossing can be built exactly where the script needs them.
export function kinematics(script, path) {
  const bumpT = script.steps.filter((s) => s.name === 'bump').map((s) => ({ t: s.t + 0.25, n: s.n }));
  const gs = script.steps.find((s) => s.name === 'goose');
  const g0 = gs.t + 2.8;
  const g1 = gs.t + 11.0;
  const tEnd = script.end;
  const shape = (t) => {
    let v = 1;
    for (const b of bumpT) v *= 1 - 0.5 * Math.exp(-(((t - b.t) / 1.5) ** 2));
    v *= 1 - smooth(gs.t - 0.4, g0, t) * (1 - smooth(g1, g1 + 4.5, t));
    v *= 1 - smooth(tEnd - 8, tEnd, t);
    return v;
  };
  // Cruising speed is solved so you always wake up beside the Lot F sign,
  // however long the conversation runs.
  let unit = 0;
  for (let t = 0; t < tEnd; t += 0.02) unit += shape(t + 0.01) * 0.02;
  const V0 = (path.sStop - path.sWake) / unit;
  const speedAt = (t) => V0 * shape(t);
  const h = 0.02;
  const tab = [0];
  let d = 0;
  for (let t = T0; t < tEnd + 2; t += h) {
    d += speedAt(t + h / 2) * h;
    tab.push(d);
  }
  const distAt = (t) => {
    const i = clamp((t - T0) / h, 0, tab.length - 1.001);
    const i0 = Math.floor(i);
    return lerp(tab[i0], tab[i0 + 1], i - i0);
  };
  const total = distAt(tEnd);
  const sAt = (t) => path.sStop - (total - distAt(t));
  return {
    V0,
    speedAt,
    sAt,
    tEnd,
    bumps: bumpT.map((b) => ({ n: b.n, s: sAt(b.t) + 2.6, f: false, r: false })),
    goose: { t: gs.t, stop: g0, go: g1, s: sAt(g0) + 4.0 + 7.5 },
    startS: sAt(T0),
  };
}

// ---- helpers --------------------------------------------------------------
function lookKey(G, key) {
  if (key === 'you') return G.camera;
  if (key === 'front') return G.targets.front;
  if (key === 'pond') return G.targets.pond;
  if (key === 'plaza') return G.targets.plaza;
  if (key === 'sky') return G.targets.sky;
  if (G.cast[key]) return G.cast[key].head;
  return null;
}

export function say(G, who, text, o = {}) {
  const Wh = WHO[who];
  const person = G.cast[who];
  const dur = o.dur ?? sayDur(text);
  const reveal = Math.min(dur * 0.55, text.length * 0.034);
  const token = ++G.sayToken;
  const voice = { ...Wh.voice, whisper: !!o.whisper, far: !!o.far };
  G.ui.sub(Wh.name, Wh.color, '', !!o.whisper);
  if (person) {
    if ('to' in o) person.lookTarget = lookKey(G, o.to);
    for (const L of G.listeners) {
      if (L === person || L.asleep || L.busy) continue;
      if (L.id === 'rahul' && !G.rahulUp) continue;
      const d = 0.15 + Math.random() * 0.5;
      G.dir.wait(d).then(() => {
        if (token === G.sayToken) L.lookTarget = person.head;
      });
    }
  }
  let shown = 0;
  G.dir.tween(reveal, (k) => {
    if (token !== G.sayToken) return;
    const n = Math.round(k * text.length);
    if (n === shown) return;
    const ch = text[n - 1];
    if (ch && /[a-z0-9]/i.test(ch) && n % 2 === 0) G.snd.blip(voice, ch);
    shown = n;
    G.ui.subText(text.slice(0, n));
    if (person) {
      person.pulse();
      person.talk = 1;
    }
  }, ease.lin);
  return G.dir.wait(dur).then(() => {
    if (token === G.sayToken && !o.keep) G.ui.clearSub();
  });
}
async function line(G, who, text, o = {}) {
  await say(G, who, text, o);
  await G.dir.wait(o.gap ?? 0.3);
}

function busPoint(G, x, y, z) {
  G.bus.group.updateMatrixWorld(true);
  return G.bus.body.localToWorld(new THREE.Vector3(x, y, z));
}
function detach(G, person) {
  G.scene.attach(person.group);
  person.group.rotation.x = 0;
  person.group.rotation.z = 0;
}
function seat(G, person, key) {
  const s = SEAT[key];
  G.bus.body.add(person.group);
  person.group.position.set(s.x, F, s.z);
  person.group.rotation.set(0, s.yaw, 0);
  person.sit = person.sitTarget = 1;
  person.faceYaw = null;
}
function stand(G, person, x, z, yaw) {
  G.scene.add(person.group);
  person.group.position.set(x, PY, z);
  person.group.rotation.set(0, yaw, 0);
  person.faceYaw = yaw;
  person.sit = person.sitTarget = 0;
}
function exitPath(G, key) {
  const s = SEAT[key];
  const ax = s.x > 0 ? 0.3 : -0.3;
  return [
    busPoint(G, ax, F, s.z),
    busPoint(G, 0.05, F, -2.3),
    busPoint(G, 0.55, F, -3.08),
    busPoint(G, 1.5, 0.3, -3.08),
    busPoint(G, 2.35, PY, -3.08),
  ];
}
const P = (x, z) => new THREE.Vector3(x, PY, z);
const WEST = -Math.PI / 2;
const EAST = Math.PI / 2;

function setMarker(G, x, z) {
  const m = G.marker;
  if (x === null) {
    m.visible = false;
    G.player.auto = null;
    return;
  }
  m.visible = true;
  m.position.set(x, PY, z);
  if (G.auto) G.player.auto = { x, z };
}
function near(G, x, z, r) {
  return Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r;
}
async function settle(G, x, z, yaw, dur = 0.5) {
  const pl = G.player;
  pl.moveEnabled = false;
  pl.auto = null;
  G.input.releaseJoy();
  const x0 = pl.pos.x;
  const z0 = pl.pos.z;
  const turn = yaw === null ? null : pl.lookTo(yaw, 0, Math.max(dur, 0.6));
  await G.dir.tween(dur, (k) => {
    pl.pos.x = lerp(x0, x, k);
    pl.pos.z = lerp(z0, z, k);
  });
  if (turn) await turn;
}
function give(person, hand) {
  if (person.lanyard) person.lanyard.visible = true;
  const t = tote();
  t.traverse((o) => o.isMesh && (o.castShadow = true));
  person.hold(hand, t);
}

// ---- staging --------------------------------------------------------------
export function stage(G) {
  const { cast, bus } = G;
  for (const k of ['dee', 'toby', 'rahul', 'reader', 'sleeper', 'driver']) seat(G, cast[k], k);
  cast.reader.busy = true;
  cast.sleeper.headRoll = -0.32;
  cast.sleeper.headPitch = 0.12;
  cast.driver.lookTarget = null;
  cast.toby.addLanyard('#1f9aa0').visible = false;
  cast.rahul.addLanyard('#b23a48').visible = false;
  cast.dee.addLanyard('#3b5f8a').visible = false;
  cast.reader.addLanyard('#2a2c30');
  cast.sleeper.addLanyard('#f2c230');
  cast.greg.addLanyard('#2a2c30');
  for (const k in cast) cast[k].group.traverse((o) => o.isMesh && (o.castShadow = true));

  stand(G, cast.priya, SPOT.priya[0], SPOT.priya[1], EAST);
  stand(G, cast.greg, SPOT.greg[0], SPOT.greg[1], EAST);
  cast.greg.lookTarget = G.targets.sky;
  cast.priya.lookTarget = G.targets.road;

  G.listeners = [cast.dee, cast.toby, cast.rahul];
  placeBus(G, T0);
}

function placeBus(G, rt) {
  const K = G.kin;
  const s = K.sAt(rt);
  const f = G.path.frame(s);
  const lat = 1.75 + 0.55 * smooth(K.tEnd - 9, K.tEnd - 1, rt);
  G.bus.group.position.set(f.p.x + f.r.x * lat, 0, f.p.z + f.r.z * lat);
  G.bus.group.rotation.y = f.yaw;
  return { s, f };
}

// Runs every step while the shuttle is on the road.
export function rideUpdate(G, dt) {
  if (!G.riding) return;
  const K = G.kin;
  G.rideT = Math.min(G.rideT + dt, K.tEnd);
  const rt = G.rideT;
  const { s } = placeBus(G, rt);
  const v = K.speedAt(rt);
  const a = (K.speedAt(rt + 0.05) - K.speedAt(rt - 0.05)) / 0.1;
  const yr = angDiff(G.path.frame(s - 0.6).yaw, G.path.frame(s + 0.6).yaw) / 1.2;
  G.bus.pTarget = clamp(a * 0.013, -0.045, 0.03);
  G.bus.rTarget = clamp(-yr * v * v * 0.012, -0.045, 0.045);
  for (const b of K.bumps) {
    if (!b.f && s + 2.6 >= b.s) {
      b.f = true;
      G.bus.kick(0.5, 0.5);
      G.snd.bumpHit(1);
      G.player.bump(0.4);
      G.bumpCount = b.n;
    }
    if (!b.r && s - 2.5 >= b.s) {
      b.r = true;
      G.bus.kick(0.55, -0.55);
      G.snd.bumpHit(0.8);
      G.player.bump(0.5);
    }
  }
  G.busSpeed = v;
}

// ---- act one: the shuttle -------------------------------------------------
export async function intro(G) {
  const { ui, dir, snd, player, cast, bus } = G;
  G.phase = 'intro';
  bus.body.add(player.rig);
  player.rig.position.set(SEAT.you.x + 0.02, F + 1.17, SEAT.you.z);
  player.rig.rotation.set(0, Math.PI / 2, 0);
  player.yawLim = [-2.0, 1.9];
  player.pitchLim = [-1.05, 0.85];
  player.yaw = 0.22;
  player.pitch = -0.98;
  G.riding = true;
  G.engineLevel = 1;
  snd.startEngine();
  snd.startMuzak();
  if (G.skipRide) {
    G.rideT = G.kin.tEnd - 0.5;
    for (const b of G.kin.bumps) b.f = b.r = true;
    ui.fade = 0;
    player.yaw = 0;
    player.pitch = 0;
    player.lookEnabled = true;
    G.input.setUI(false);
    ui.showHud(true);
    return;
  }
  ui.lid = 0;
  ui.blur = 14;
  G.rideT = T0;
  await dir.wait(1.2);
  ui.stamp('Monday, 7:42 AM', 'Lot F shuttle  ·  Wexcombe Paper & Cloud');
  await dir.to(ui, { stampA: 1 }, 1.4);
  await dir.wait(2.6);
  await dir.to(ui, { stampA: 0 }, 1.2);
  ui.fade = 0;
  await dir.wait(0.4);
  G.mark('lids');
  await dir.to(ui, { lid: 0.3 }, 0.9);
  await dir.wait(0.5);
  await dir.to(ui, { lid: 0 }, 0.35);
  await dir.wait(0.5);
  dir.to(ui, { blur: 0 }, 3.2);
  await dir.to(ui, { lid: 1 }, 1.1);
  cast.dee.lookTarget = G.camera;
  await dir.wait(0.4);
  await player.lookTo(0, -0.04, 2.0);
  player.lookEnabled = true;
  G.input.setUI(false);
  ui.showHud(true);
  ui.hint('Look around: move the mouse, or drag.');
  dir.wait(9).then(() => ui.hint(''));
  G.mark('awake');
}

async function deeSips(G) {
  const dee = G.cast.dee;
  while (G.riding && G.phase === 'ride') {
    await G.dir.wait(11 + Math.random() * 9);
    if (!G.riding || G.phase !== 'ride' || dee.talk > 0.05 || G.gooseOnRoad) continue;
    dee.setArms('R', { x: -1.0, z: -0.3, f: -1.9 });
    await G.dir.wait(1.5);
    dee.setArms('R', null);
  }
}

// Everybody looks at you. Nobody says why.
async function glance(G, d) {
  const { rahul, dee, toby } = G.cast;
  G.rahulUp = true;
  rahul.headPitch = 0;
  rahul.lookTarget = G.camera;
  dee.lookTarget = G.camera;
  toby.lookTarget = G.camera;
  G.mark('glance');
  await G.dir.wait(d);
  G.rahulUp = false;
  rahul.lookTarget = null;
  rahul.headPitch = 0.55;
}

async function gooseCrossing(G) {
  const { dir, snd, cast, gerald, path } = G;
  const K = G.kin;
  const f = path.frame(K.goose.s);
  const at = (lat) => new THREE.Vector3(f.p.x + f.r.x * lat, 0.03, f.p.z + f.r.z * lat);
  const A = at(3.3);
  const M = at(0.2);
  const B = at(-7.6);
  const yaw = Math.atan2(B.x - A.x, B.z - A.z);
  gerald.group.position.copy(A);
  gerald.group.rotation.set(0, yaw, 0);
  gerald.pose('stand');
  gerald.snap();
  gerald.group.visible = true;
  G.gooseOnRoad = true;
  const go = (from, to, speed) => {
    gerald.speed = speed;
    const d = from.distanceTo(to) / speed;
    return dir.tween(d, (k) => gerald.group.position.lerpVectors(from, to, k), ease.lin).then(() => (gerald.speed = 0));
  };
  snd.brake();
  cast.dee.lookTarget = G.targets.front;
  cast.toby.lookTarget = G.targets.front;
  G.mark('gooseStart');
  const walk1 = go(A, M, 0.78);
  await dir.wait(1.3);
  snd.chime();
  await dir.wait(0.5);
  say(G, 'driver', 'Hold, please. Goose.', { dur: 2.0 });
  await walk1;
  gerald.lookAt(busPoint(G, 0, 1.6, -4));
  G.mark('gooseStare');
  await dir.wait(0.4);
  say(G, 'dee', "Don't look at it.", { whisper: true, dur: 1.6 });
  await dir.wait(1.7);
  gerald.pose('honk');
  snd.honk({ v: 0.5, dist: 0.3 });
  await dir.wait(0.6);
  gerald.pose('stand');
  await dir.wait(0.4);
  gerald.lookYawT = 0;
  gerald.lookPitchT = 0;
  const walk2 = go(M, B, 0.9);
  G.rahulUp = true;
  cast.rahul.headPitch = 0;
  say(G, 'rahul', "That's Gerald.", { to: 'front', dur: 1.6 });
  await dir.wait(1.9);
  say(G, 'dee', "We don't say his name.", { whisper: true, to: 'rahul', dur: 2.0 });
  await dir.wait(2.2);
  G.rahulUp = false;
  cast.rahul.lookTarget = null;
  cast.rahul.headPitch = 0.55;
  cast.dee.lookTarget = G.targets.pond;
  cast.toby.lookTarget = G.targets.pond;
  await walk2;
  // he watches the shuttle leave
  const watch = () => {
    if (!G.riding) return true;
    gerald.lookAt(G.camera.getWorldPosition(new THREE.Vector3()));
    return G.rideT > K.goose.go + 13;
  };
  await dir.until(watch);
  gerald.group.visible = false;
  G.gooseOnRoad = false;
}

export async function ride(G) {
  const { dir, snd, cast } = G;
  G.phase = 'ride';
  const R = G.script;
  deeSips(G);
  for (const st of G.skipRide ? [] : R.steps) {
    await dir.until(() => G.rideT >= st.t);
    if (st.k === 'say') say(G, st.who, st.text, st);
    else if (st.name === 'goose') gooseCrossing(G);
    else if (st.name === 'pa') snd.chime();
    else if (st.name === 'glance') glance(G, st.d);
    else if (st.name === 'bump') G.mark('bump' + st.n);
    if (st.k === 'say' && st.to === 'plaza') G.mark('plazaLine');
  }
  await dir.until(() => G.rideT >= R.end);
  cast.dee.lookTarget = G.camera;
  cast.toby.lookTarget = G.targets.plaza;
}

// ---- act two: off the shuttle --------------------------------------------
async function rail(G, pts, speed) {
  const pl = G.player;
  const rig = pl.rig;
  for (const to of pts) {
    const from = rig.position.clone();
    const len = from.distanceTo(to);
    const y0 = rig.rotation.y;
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const yT = flat > 0.2 ? Math.atan2(-(to.x - from.x), -(to.z - from.z)) : y0;
    pl.railSpeed = speed;
    await G.dir.tween(len / speed, (k) => {
      rig.position.lerpVectors(from, to, k);
      rig.rotation.y = y0 + angDiff(y0, yT) * smooth(0, 0.5, k);
    }, ease.lin);
  }
  pl.railSpeed = 0;
}

export async function arrive(G) {
  const { dir, snd, cast, bus, player, ui, scene } = G;
  G.phase = 'arrive';
  G.mark('arrive');
  bus.ledStatic = 'BUILDING C';
  bus.doorTarget = 1;
  snd.door();
  snd.stopMuzak(0.03);
  dir.to(G, { engineLevel: 0 }, 1.6);
  snd.startOutdoor();
  dir.to(G, { outdoor: 0.55 }, 2.5);
  await dir.wait(0.9);
  await line(G, 'driver', 'Building C.', { dur: 1.4 });

  const toDot = (i) => [P(-8.2, 141.3), P(-15, 140.6), P(SPOT.dots[i][0], SPOT.dots[i][1])];
  const toQueue = (i) => [P(-8.2, 141.3), P(-13.2, 147), P(-16.2, 150), P(SPOT.queue[i][0], SPOT.queue[i][1])];
  const leave = async (key, rest, speed) => {
    const p = cast[key];
    const pts = exitPath(G, key);
    detach(G, p);
    await p.walk([...pts, ...rest], speed, WEST);
  };
  // reader folds the paper and goes first
  cast.reader.paper.visible = false;
  cast.reader.sitArms = { L: { x: -0.2, z: 0.05, f: -1.0 }, R: { x: -0.2, z: -0.05, f: -1.0 } };
  cast.reader.headPitch = 0;
  cast.reader.busy = false;
  G.done.reader = leave('reader', toDot(6), 1.3);
  await dir.wait(0.9);
  const toby = cast.toby;
  toby.lapPack.visible = false;
  toby.backPack.visible = true;
  toby.hips.remove(toby.book);
  toby.book.position.set(0.02, -0.06, 0.1);
  toby.book.rotation.set(0.1, 0, 1.45);
  toby.hold('L', toby.book);
  toby.sitArms = toby.standArms;
  toby.fidget = 0;
  G.done.toby = leave('toby', toQueue(0), 1.7);
  await dir.wait(0.8);
  const sl = cast.sleeper;
  sl.asleep = false;
  sl.noBlink = false;
  sl.eyesClosed = 0;
  sl.headRoll = 0;
  sl.headPitch = 0;
  await dir.wait(0.7);
  G.done.sleeper = leave('sleeper', toDot(8), 1.35);
  const rahul = cast.rahul;
  rahul.phone.visible = false;
  rahul.headPitch = 0;
  rahul.lean = 0;
  rahul.sitArms = rahul.standArms;
  await dir.wait(0.6);
  G.done.rahul = leave('rahul', toQueue(1), 1.25);
  await dir.wait(1.6);
  say(G, 'rahul', 'See you Monday, Sal.', { to: 'driver', dur: 1.8 });
  await dir.wait(2.0);
  rahul.lookTarget = null;
  await line(G, 'driver', 'Yep.', { dur: 1.2 });

  // Dee waits for you
  const dee = cast.dee;
  detach(G, dee);
  const dp = exitPath(G, 'dee');
  dee.walk([dp[0]], 0.7).then(() => dee.facePoint(player.rig.getWorldPosition(new THREE.Vector3())));
  dee.lookTarget = G.camera;
  await dir.wait(1.0);
  await line(G, 'dee', 'Well. Here we go.', { to: 'you', dur: 1.7 });
  await line(G, 'dee', 'One piece of advice.', { to: 'you', dur: 1.7 });
  await line(G, 'dee', "When they ask for a fun fact, don't have one.", { to: 'you' });
  G.mark('advice');
  dee.lookTarget = null;
  G.done.dee = dee.walk([...dp.slice(1), ...toQueue(2)], 1.6, WEST);
  await dir.wait(1.3);

  // you stand up and follow her out
  ui.hint('');
  bus.lap.visible = false;
  const rig = player.rig;
  const y0 = player.yaw;
  const p0 = player.pitch;
  player.railSpeed = 0.6;
  await dir.tween(1.4, (k) => {
    rig.position.set(lerp(SEAT.you.x + 0.02, 0.3, k), lerp(F + 1.17, F + 1.6, k), SEAT.you.z);
    rig.rotation.y = lerp(Math.PI / 2, 0, k);
    player.yaw = lerp(y0, 0, k);
    player.pitch = lerp(p0, -0.05, k);
  });
  player.yawLim = [-1.7, 1.7];
  player.pitchLim = [-1.2, 1.2];
  scene.attach(rig);
  rig.rotation.x = 0;
  rig.rotation.z = 0;
  player.onStep = () => snd.step(0.7);
  cast.driver.lookTarget = G.camera;
  const pts = [busPoint(G, 0.12, F + 1.6, -2.25), busPoint(G, 0.6, F + 1.6, -3.08)];
  await rail(G, pts, 1.15);
  say(G, 'driver', 'Good luck in there, chief.', { dur: 2.0 });
  await rail(G, [busPoint(G, 1.55, F + 1.42, -3.08), new THREE.Vector3(-4.8, PY + 1.62, busPoint(G, 0, 0, -3.08).z)], 1.0);
  player.flatten();
  player.ground = PY;
  player.onStep = () => snd.step(1);
  cast.driver.lookTarget = null;
  dir.to(G, { outdoor: 1 }, 1.5);
  G.mark('outside');
}

async function busLeaves(G) {
  const { dir, snd, bus, path } = G;
  await dir.wait(3.2);
  bus.doorTarget = 0;
  snd.door();
  await dir.wait(1.4);
  bus.ledStatic = null;
  bus.lamp.visible = false;
  G.busAway = true;
  dir.to(G, { engineLevel: 0.7 }, 1.0);
  const s0 = path.sStop;
  await dir.tween(17, (k) => {
    const s = s0 + 150 * k * k;
    const f = path.frame(s);
    const lat = 2.3 - 0.55 * smooth(0, 0.2, k);
    bus.group.position.set(f.p.x + f.r.x * lat, 0, f.p.z + f.r.z * lat);
    bus.group.rotation.y = f.yaw;
    G.busSpeed = 300 * k * (1 / 17);
    G.engineLevel = 0.7 * (1 - smooth(0.1, 0.9, k));
  }, ease.lin);
  bus.group.visible = false;
  G.engineLevel = 0;
}

export async function walkToQueue(G) {
  const { dir, cast, player, ui } = G;
  G.phase = 'walk';
  busLeaves(G);
  const slot = SPOT.queue[3];
  player.obstacles = [
    { p: cast.greg.group.position, r: 0.45 },
    { x: SPOT.gooseSign[0], z: SPOT.gooseSign[1], r: 0.75 },
    { p: cast.dee.group.position, r: 0.42 },
    { p: cast.rahul.group.position, r: 0.42 },
    { p: cast.toby.group.position, r: 0.42 },
    { x: -13.2, z: 143.1, r: 0.2 },
    { x: -13.2, z: 150.9, r: 0.2 },
  ];
  player.bounds = { x0: -17.3, x1: -4.8, z0: 133.6, z1: 152.2 };
  player.moveEnabled = true;
  ui.objective('Join the line at the tent.');
  ui.hint('Walk: W A S D, or left thumb.');
  dir.wait(8).then(() => G.phase === 'walk' && ui.hint(''));
  setMarker(G, slot[0], slot[1]);
  cast.priya.lookTarget = G.camera;
  for (const k of ['toby', 'rahul', 'dee']) G.done[k].then(() => (cast[k].lookTarget = cast.priya.head));

  let arrived = false;
  const patter = (async () => {
    await dir.wait(0.8);
    await line(G, 'priya', 'Good morning, new hires! Welcome to Day One!', { far: true });
    await line(G, 'priya', 'Line up at the tent. Single file, biggest smile!', { far: true });
    await dir.until(() => arrived || near(G, SPOT.greg[0], SPOT.greg[1], 4.2) || G.player.moved > 9);
    if (arrived) return;
    const greg = cast.greg;
    greg.lookTarget = G.camera;
    await line(G, 'greg', 'Morning.', { dur: 1.4 });
    if (arrived) return;
    await line(G, 'greg', "Stay on the pavers. Don't run.");
    greg.lookTarget = G.targets.sky;
    if (arrived) return;
    await line(G, 'greg', 'They chase what runs.', { dur: 2.0 });
    if (arrived) return;
    greg.lookTarget = G.camera;
    await line(G, 'greg', 'And zip the jacket. They like shiny.');
    greg.lookTarget = G.targets.sky;
  })();
  await dir.until(() => near(G, slot[0], slot[1], 0.75));
  arrived = true;
  cast.greg.lookTarget = G.targets.sky;
  setMarker(G, null);
  ui.objective(null);
  ui.hint('');
  await settle(G, slot[0], slot[1], Math.PI / 2, 0.6);
  await patter;
  G.mark('queued');
}

async function advance(G, people, playerSlot) {
  const jobs = people.map(([p, i]) => p.walk([P(SPOT.queue[i][0], SPOT.queue[i][1])], 0.9, WEST));
  const pl = G.player;
  pl.railSpeed = 0.8;
  jobs.push(G.dir.to(pl.pos, { x: SPOT.queue[playerSlot][0], z: SPOT.queue[playerSlot][1] }, 1.4).then(() => (pl.railSpeed = 0)));
  await Promise.all(jobs);
}

export async function rollCall(G) {
  const { dir, cast, player, ui } = G;
  const { priya, toby, rahul, dee } = cast;
  G.phase = 'rollcall';
  G.listeners = [];
  await Promise.all([G.done.toby, G.done.rahul, G.done.dee]);
  if (G.auto) player.lookAt(priya.head.getWorldPosition(new THREE.Vector3()), 0.8);

  priya.lookTarget = toby.head;
  toby.lookTarget = priya.head;
  await line(G, 'priya', 'Good morning! Name?', { dur: 1.7 });
  await line(G, 'toby', "Tobias Finch. Summer analyst. I've read the handbook.");
  await line(G, 'priya', 'Wow. All of it?', { dur: 1.6 });
  await line(G, 'toby', 'Twice.', { dur: 1.2 });
  await line(G, 'priya', 'Even section nine?', { dur: 1.7 });
  await line(G, 'toby', '"In the Event of Geese."', { dur: 2.2, gap: 0.9 });
  await line(G, 'priya', 'Badge. Tote. Dot.', { dur: 1.9 });
  give(toby, 'R');
  toby.lookTarget = null;
  G.done.tobyDot = toby.walk([P(-21.2, 147.6), P(-24.6, 141.5), P(SPOT.dots[0][0], SPOT.dots[0][1])], 1.5, WEST);
  await advance(G, [[rahul, 0], [dee, 1]], 2);

  priya.lookTarget = rahul.head;
  rahul.lookTarget = priya.head;
  await line(G, 'priya', 'Rahul! Welcome back!', { dur: 1.8 });
  await line(G, 'rahul', 'Hey, Priya.', { dur: 1.4 });
  await line(G, 'priya', 'Did the laptop', { dur: 1.1, gap: 0 });
  await line(G, 'rahul', 'No.', { dur: 1.1, gap: 0.7 });
  await line(G, 'priya', 'Dot.', { dur: 1.1 });
  give(rahul, 'R');
  rahul.lookTarget = null;
  G.done.rahulDot = rahul.walk([P(-21.2, 147.6), P(-22, 142), P(SPOT.dots[4][0], SPOT.dots[4][1])], 1.2, WEST);
  await advance(G, [[dee, 0]], 1);

  priya.lookTarget = dee.head;
  dee.lookTarget = priya.head;
  await line(G, 'priya', 'Good morning! Name?', { dur: 1.7 });
  await line(G, 'dee', 'Dolores Whitlock. Accounts Payable. Thirty-one years.');
  await line(G, 'priya', 'Dolores... Dolores... Here you are! New hire, starting today.');
  await line(G, 'priya', 'Welcome to Wexcombe!', { dur: 1.7 });
  await line(G, 'dee', 'I hired your manager.', { dur: 1.9 });
  await line(G, 'priya', 'Fun! Save it for the icebreaker.');
  give(dee, 'L');
  dee.lookTarget = null;
  G.done.deeDot = dee.walk([P(-21.2, 147.6), P(-24.9, 142.5), P(SPOT.dots[2][0], SPOT.dots[2][1])], 1.2, WEST);
  await advance(G, [], 0);
  G.mark('tape');
}

export async function creator(G) {
  const { dir, cast, player, ui, input } = G;
  const priya = cast.priya;
  G.phase = 'creator';
  priya.lookTarget = G.camera;
  await line(G, 'priya', 'Next! Hi! Toes on the tape. Eyes on the lens.');
  await line(G, 'priya', "Is the jacket staying on? ...Okay! The jacket's staying on.");
  priya.setArms('L', { x: -1.45, z: -0.25, f: -1.25 });
  player.lookEnabled = false;
  input.setUI(true);
  const narrow = window.innerWidth < 700;
  const a = player.anglesTo(priya.head.getWorldPosition(new THREE.Vector3()));
  await player.lookTo(a.yaw - (narrow ? 0 : 0.3), a.pitch - (narrow ? 0.32 : 0.02), 0.9);
  G.onPhoto = () => {
    priya.setArms('L', null);
    priya.lookTarget = priya.tablet;
  };
  G.mark('kiosk');
  const badge = await ui.creator(G.auto);
  G.badge = badge;
  input.setUI(false);
  player.lookEnabled = true;
  if (!input.touch) ui.hint('Click the view to look around again.');
  dir.wait(5).then(() => ui.hint(''));
  await player.lookTo(a.yaw, a.pitch, 0.6);
  const name = badgeName(badge);
  await line(G, 'priya', "Oh. That's... a photo.", { dur: 2.0 });
  priya.lookTarget = G.camera;
  await line(G, 'priya', "We don't do retakes.", { dur: 1.8 });
  priya.lookTarget = priya.tablet;
  await line(G, 'priya', `${name}. ${DEPTS[badge.dept].n}. All I have is a resume somebody scanned sideways.`);
  await line(G, 'priya', 'Last job: thirty-three years, same company. Founder. Before that... dishwasher.', { gap: 0.5 });
  await line(G, 'priya', 'Reason for leaving: "It was going too well."', { gap: 0.7 });
  priya.lookTarget = G.camera;
  await line(G, 'priya', 'Okay!', { dur: 1.2 });
  await line(G, 'priya', "You had sixty direct reports. Here you get a buddy. It's Rahul.");
  G.mark('resume');
  await line(G, 'priya', 'Find a dot!', { dur: 1.4 });
}

export async function toDot(G) {
  const { dir, cast, player, ui } = G;
  G.phase = 'dot';
  const free = [1, 3, 5, 7].map((i) => SPOT.dots[i]);
  const occ = [cast.toby, cast.dee, cast.rahul, cast.reader, cast.sleeper];
  player.obstacles = [
    ...occ.map((p) => ({ p: p.group.position, r: 0.4 })),
    { p: cast.priya.group.position, r: 0.45 },
    { x: SPOT.table[0], z: SPOT.table[1], r: 1.05 },
    { x: SPOT.table[0], z: SPOT.table[1] - 0.8, r: 0.7 },
    { x: -22.25, z: 148.25, r: 0.25 },
    { x: SPOT.cocktail[0], z: SPOT.cocktail[1], r: 0.5 },
  ];
  player.bounds = { x0: -25.0, x1: -13, z0: 135.2, z1: 151.4 };
  player.moveEnabled = true;
  ui.objective('Find a dot. Stand on it.');
  setMarker(G, SPOT.dots[5][0], SPOT.dots[5][1]);
  if (G.auto) {
    player.auto = { x: -20.9, z: 144 };
    dir.until(() => near(G, -20.9, 144, 0.5)).then(() => (player.auto = { x: SPOT.dots[5][0], z: SPOT.dots[5][1] }));
  }
  // Priya heads for the carpet
  const priya = cast.priya;
  priya.lookTarget = null;
  G.done.priyaIce = priya.walk([P(-25.6, 150), P(-26.4, 146), P(-25.2, 141.2), P(-25.2, 136.4), P(SPOT.priyaIce[0], SPOT.priyaIce[1])], 1.3).then(() => priya.facePoint(new THREE.Vector3(-22, 0, 138.4)));
  let dot = null;
  await dir.until(() => {
    for (const d of free) if (near(G, d[0], d[1], 0.5)) dot = d;
    return !!dot;
  });
  setMarker(G, null);
  ui.objective(null);
  G.myDot = dot;
  await settle(G, dot[0], dot[1], Math.PI / 2, 0.5);
  G.mark('onDot');
}

// ---- act three: the icebreaker -------------------------------------------
export async function icebreaker(G) {
  const { dir, cast, player, ui, snd, input } = G;
  const { priya, toby, dee, rahul } = cast;
  G.phase = 'ice';
  await G.done.priyaIce;
  await Promise.all([G.done.tobyDot, G.done.rahulDot, G.done.deeDot]);
  const group = [toby, dee, rahul, cast.reader, cast.sleeper];
  for (const p of group) p.lookTarget = priya.head;
  priya.lookTarget = G.targets.group;
  if (G.auto) player.lookAt(priya.head.getWorldPosition(new THREE.Vector3()), 0.8);
  priya.setArms('R', { x: -1.2, z: 0.35, f: -1.3 });
  await dir.wait(0.35);
  snd.clap();
  await dir.wait(0.3);
  snd.clap();
  await dir.wait(0.2);
  priya.setArms('R', null);
  await line(G, 'priya', 'Okay, team! Eyes up here.', { dur: 1.9 });
  await line(G, 'priya', "Before the tour, we're going to do a quick icebreaker.");
  snd.dreadStart();
  dir.to(ui, { bars: 1 }, 2.6);
  dir.to(G, { outdoor: 0.35 }, 3);
  dee.eyesClosed = 1;
  dee.noBlink = true;
  rahul.headPitch = 0.4;
  rahul.lookTarget = null;
  await dir.wait(0.7);
  await line(G, 'dee', 'Here it comes.', { whisper: true, dur: 1.7 });
  dee.eyesClosed = 0;
  dee.noBlink = false;
  await line(G, 'priya', 'Step onto the Sharing Carpet. Give us your name, your role, and one fun fact about yourself.');
  await line(G, 'priya', "Who'd like to go first?", { dur: 2.0, gap: 0 });
  G.mark('silence');
  await dir.wait(1.3);
  snd.honk({ v: 0.12, dist: 1, pitch: 0.94 });
  cast.greg.lookTarget = G.targets.sky;
  await dir.wait(1.5);
  toby.setArms('R', { x: -2.7, z: -0.15, f: -0.15 });
  toby.lookTarget = priya.head;
  await dir.wait(0.8);
  dee.lookTarget = toby.head;
  await line(G, 'dee', 'Tobias. No.', { whisper: true, dur: 1.5, gap: 0.1 });
  toby.setArms('R', null);
  dee.lookTarget = priya.head;
  await line(G, 'priya', "Don't everybody jump at once!", { dur: 2.1 });
  priya.lookTarget = G.camera;
  await dir.wait(0.7);
  const name = badgeName(G.badge);
  await line(G, 'priya', `How about our mystery guest? ${name}! Come on up.`);
  for (const p of group) p.lookTarget = G.camera;

  G.phase = 'carpet';
  const [cx, cz] = SPOT.carpet;
  player.obstacles = [
    ...group.map((p) => ({ p: p.group.position, r: 0.4 })),
    { p: priya.group.position, r: 0.45 },
    { x: SPOT.cocktail[0], z: SPOT.cocktail[1], r: 0.55 },
  ];
  player.bounds = { x0: -28.7, x1: -19.6, z0: 135.4, z1: 140.6 };
  player.moveEnabled = true;
  player.onStep = () => {
    snd.step(0.8);
    snd.drum(0.42);
  };
  ui.objective('Step onto the Sharing Carpet.');
  setMarker(G, cx, cz);
  if (G.auto) {
    player.auto = { x: -25.4, z: 136.3 };
    dir.until(() => near(G, -25.4, 136.3, 0.45)).then(() => (player.auto = { x: -27.2, z: 136.6 }));
    dir.until(() => near(G, -27.2, 136.6, 0.45)).then(() => (player.auto = { x: cx, z: cz }));
  }
  await dir.until(() => near(G, cx, cz, 0.6));
  setMarker(G, null);
  ui.objective(null);
  player.onStep = () => snd.step(1);
  await settle(G, cx, cz, -Math.PI / 2, 0.7);
  snd.drum(0.7);
  G.mark('onCarpet');
  await dir.wait(0.6);
  await line(G, 'priya', "Whenever you're ready.", { dur: 1.8, gap: 0.2 });

  input.setUI(true);
  player.lookEnabled = false;
  const facts = [
    'I started my last company in a diner booth.',
    'I was a very good dishwasher.',
    'I own several of this exact jacket.',
    'I once gave a keynote from my kitchen.',
    "I don't have a fun fact.",
  ];
  const idx = await ui.choose('Your fun fact', facts, G.auto);
  return facts[idx];
}

function shadowDecal() {
  const tex = canvasTex(256, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let pass = 0; pass < 7; pass++) {
      const s = 1 + pass * 0.07;
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.save();
      g.translate(w / 2, h / 2);
      g.scale(s, s);
      g.beginPath();
      g.ellipse(0, 0, 34, 13, 0, 0, 7);
      g.fill();
      g.beginPath();
      g.moveTo(-6, -8);
      g.quadraticCurveTo(-26, -58, -4, -66);
      g.quadraticCurveTo(22, -40, 16, -8);
      g.moveTo(-6, 8);
      g.quadraticCurveTo(-26, 58, -4, 66);
      g.quadraticCurveTo(22, 40, 16, 8);
      g.fill();
      g.fillRect(-66, -3, 36, 6);
      g.restore();
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 13.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = PY + 0.03;
  m.renderOrder = 3;
  return m;
}

export async function finale(G, fact) {
  const { dir, cast, player, ui, snd, gerald, world, scene } = G;
  const { priya, greg } = cast;
  G.phase = 'finale';
  const group = [cast.toby, cast.dee, cast.rahul, cast.reader, cast.sleeper];
  ui.objective(null);
  ui.hint('');
  // you get four words in
  const sp = fact.indexOf(' ', 11);
  const cut = sp > 0 ? sp : Math.min(fact.length - 2, 12);
  const W = WHO.you;
  ui.sub(W.name, W.color, '');
  G.sayToken++;
  await dir.tween(cut * 0.05, (k) => {
    const n = Math.round(k * cut);
    ui.subText(fact.slice(0, n));
    if (n % 2 === 0 && fact[n - 1] && /[a-z]/i.test(fact[n - 1])) snd.blip(W.voice, fact[n - 1]);
  }, ease.lin);
  ui.subText(fact.slice(0, cut) + '—');
  snd.dreadStop(0.02);
  snd.honk({ v: 0.75, dist: 0.45 });
  G.mark('honk');
  dir.to(G, { outdoor: 0.15 }, 0.3);

  // Gerald comes in out of the sun
  const [kx, kz] = SPOT.cocktail;
  const land = new THREE.Vector3(kx, PY + 1.085, kz);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(74, 23, 166),
    new THREE.Vector3(42, 16.5, 153),
    new THREE.Vector3(12, 10.5, 143.5),
    new THREE.Vector3(-10, 6.2, 139.4),
    new THREE.Vector3(-21.5, 3.3, 138.2),
    land,
  ], false, 'catmullrom', 0.5);
  gerald.group.visible = true;
  gerald.pose('fly');
  gerald.snap();
  gerald.flapRate = 15;
  gerald.group.position.copy(curve.getPointAt(0));
  gerald.group.rotation.set(0, -Math.PI / 2, 0);
  const everyone = [...group, priya, greg];
  for (const p of everyone) {
    p.lookTarget = gerald.body;
    p.lookRate = 9;
  }
  const tmp = new THREE.Vector3();
  let track = 0;
  const follow = (dt) => {
    if (!track) return;
    gerald.head.getWorldPosition(tmp);
    const a = player.anglesTo(tmp);
    const k = 1 - Math.exp(-track * dt);
    player.yaw += angDiff(player.yaw, a.yaw) * k;
    player.pitch += (a.pitch - player.pitch) * k;
  };
  G.updaters.push(follow);

  await dir.wait(0.9);
  ui.clearSub();
  greg.facePoint(curve.getPointAt(0.3));
  say(G, 'greg', 'Gerald.', { far: true, dur: 1.7 });
  track = 3.2;
  const decal = shadowDecal();
  scene.add(decal);
  let flapT = 0;
  const flight = dir.tween(6.3, (k, raw) => {
    const u = 1 - (1 - raw) ** 1.7;
    curve.getPointAt(u, gerald.group.position);
    const tan = curve.getTangentAt(Math.min(u, 0.995));
    gerald.group.rotation.y = Math.atan2(tan.x, tan.z);
    if (raw > 0.8 && gerald.poseName !== 'flare') {
      gerald.pose('flare');
      gerald.flapRate = 22;
      G.slow = 0.5;
      snd.dreadRise(0.01);
    }
    // the shadow arrives well before he does
    const sk = smooth(0.34, 0.66, raw);
    decal.position.x = lerp(8, -52, sk);
    decal.position.z = 138.6;
    decal.material.opacity = 0.5 * smooth(0.34, 0.4, raw) * (1 - smooth(0.6, 0.66, raw));
    const over = Math.exp(-(((decal.position.x - player.pos.x) / 6) ** 2)) * (decal.material.opacity > 0.01 ? 1 : 0);
    world.sun.intensity = 2.7 * (1 - 0.55 * over);
    world.hemi.intensity = 2.0 * (1 - 0.3 * over);
    const fp = Math.floor(gerald.flapPhase / (Math.PI * 2));
    if (fp !== flapT && raw > 0.45) {
      flapT = fp;
      snd.flap(0.1 + raw * 0.3);
    }
  }, ease.lin);
  await dir.wait(1.5);
  say(G, 'priya', 'Nobody make eye contact.', { whisper: true, dur: 2.2 });
  await dir.wait(0.6);
  snd.whoosh(0.3);
  G.mark('shadow');
  await flight;

  // touchdown
  G.slow = 1;
  scene.remove(decal);
  world.sun.intensity = 2.7;
  world.hemi.intensity = 2.0;
  gerald.group.position.copy(land);
  gerald.group.rotation.set(0, -Math.PI / 2, 0);
  gerald.squash = 1;
  gerald.pose('stand');
  gerald.rate = 5;
  snd.thud(0.7);
  snd.bell();
  snd.flap(0.4);
  world.scatter();
  world.balloonKick = 1;
  player.shake = 0.75;
  player.bump(0.5);
  ui.clearSub();
  G.sayToken++;
  track = 5;
  for (const p of everyone) p.lookTarget = gerald.head;
  G.mark('landed');
  await dir.wait(1.5);
  gerald.lookYawT = 1.1;
  await dir.wait(0.9);
  gerald.lookYawT = -1.1;
  await dir.wait(1.0);
  gerald.lookAt(player.rig.getWorldPosition(new THREE.Vector3()));
  await dir.wait(1.5);
  G.mark('stare');
  gerald.rate = 9;
  gerald.pose('hiss');
  gerald.shiver = 1;
  snd.hiss(0.35);
  await dir.wait(1.15);
  gerald.pose('honk');
  gerald.t.ext = 0.9;
  gerald.t.low = 0.6;
  snd.honk({ v: 1.0, dist: 0, pitch: 1.04 });
  player.shake = 1;
  G.mark('finalHonk');
  await dir.wait(0.16);
  ui.fade = 1;
  ui.bars = 0;
  track = 0;
  G.outdoor = 0;
  await dir.wait(1.7);
  say(G, 'greg', "I'll reset the sign.", { dur: 2.2 });
  await dir.wait(1.5);
  snd.clack();
  world.setGooseDays(0);
  await dir.wait(1.5);
  ui.clearSub();
  snd.jingle();
  ui.end(0);
  G.phase = 'end';
  G.mark('end');
}
