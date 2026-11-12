// Plays the whole game headlessly on autopilot and saves a screenshot at each
// story beat. Usage: node tools/playtest.cjs [--from <mark>] [--only a,b,c]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
};
const only = arg('--only') ? arg('--only').split(',') : null;
const W = +(arg('--w') || 1280);
const H = +(arg('--h') || 720);
const FAST = +(arg('--speed') || 14);

// beat -> where to look for the photo (yaw, pitch), or null to leave the view alone
const BEATS = [
  ['lids', null],
  ['awake', [0, -0.04]],
  ['bump7', [0.55, -0.02]],
  ['glance', [0.05, -0.05]],
  ['bump8', [-1.2, -0.05]],
  ['bump9', [0.2, -0.75]],
  ['bump10', [-0.45, 0.0]],
  ['gooseStart', [-1.5, -0.08]],
  ['gooseStare', [-1.52, -0.1]],
  ['bump11', [0.9, 0.0]],
  ['plazaLine', [-1.85, -0.03]],
  ['arrive', [-0.6, 0.0]],
  ['advice', null],
  ['outside', null],
  ['queued', null],
  ['tape', null],
  ['kiosk', null],
  ['resume', null],
  ['onDot', null],
  ['silence', null],
  ['onCarpet', null],
  ['honk', null],
  ['shadow', null],
  ['landed', null],
  ['stare', null],
  ['finalHonk', null],
  ['end', null],
];

(async () => {
  const out = process.env.SHOTS || path.join(__dirname, '..', 'shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && !/deprecated with r150/.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
  const q = '?auto' + (process.argv.includes('--debug') ? '&debug' : '') + (process.argv.includes('--skipride') ? '&skipride' : '');
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + q);
  await page.waitForFunction(() => window.__game && window.__game.world);
  await page.waitForTimeout(800);
  const names = BEATS.map((b) => b[0]);
  await page.evaluate(([names, FAST]) => {
    const G = window.__game;
    G.stopAt = names;
    G.speed = FAST;
    G.snd.muted = true;
  }, [names, FAST]);
  const shot = async (name) => {
    if (only && !only.includes(name)) return;
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, name + '.png') });
  };
  await shot('00-title');
  await page.click('#startBtn');
  const t0 = Date.now();
  let n = 1;
  const looks = Object.fromEntries(BEATS);
  for (;;) {
    let name;
    try {
      const h = await page.waitForFunction(() => window.__game.held || window.__game.error, null, { timeout: 240000 });
      name = await h.jsonValue();
    } catch (e) {
      const st = await page.evaluate(() => ({ phase: __game.phase, held: __game.held, marks: __game.marks, err: __game.error, rideT: __game.rideT, pos: [__game.player.pos.x, __game.player.pos.z] }));
      console.log('TIMEOUT', JSON.stringify(st));
      break;
    }
    const err = await page.evaluate(() => window.__game.error);
    if (err) {
      console.log('GAME ERROR', err);
      break;
    }
    const look = looks[name];
    if (look) {
      await page.evaluate(([y, p]) => {
        const G = window.__game;
        G.player.yaw = y;
        G.player.pitch = p;
        G.poke();
      }, look);
    }
    const label = String(n++).padStart(2, '0') + '-' + name;
    await shot(label);
    if (name === 'end') break;

    if (name === 'tape') await page.evaluate(() => (window.__game.auto = false));
    if (name === 'kiosk') {
      await page.evaluate(() => window.__game.release());
      await page.waitForSelector('#creator:not([hidden])', { timeout: 20000 });
      await page.fill('#f-name', 'J.');
      await page.click('#dept-next');
      await page.waitForTimeout(200);
      await shot(label + '-ui');
      await page.click('#takePhoto');
      await page.waitForSelector('#kioskDone:not([hidden])', { timeout: 20000 });
      await shot(label + '-printed');
      await page.click('#clipOn');
      await page.evaluate(() => (window.__game.auto = true));
      continue;
    }
    if (name === 'onCarpet') {
      await page.evaluate(() => {
        window.__game.auto = false;
        window.__game.release();
      });
      await page.waitForSelector('#choices:not([hidden])', { timeout: 60000 });
      await shot(label + '-choices');
      await page.click('#choiceList button:nth-child(1)');
      continue;
    }
    if (['honk', 'shadow', 'landed', 'stare', 'finalHonk'].includes(name)) await page.evaluate(() => (window.__game.speed = 1));
    await page.evaluate(() => window.__game.release());
  }
  await page.waitForTimeout(1500);
  await shot('99-endcard');
  const st = await page.evaluate(() => ({ phase: __game.phase, marks: __game.marks.length, err: __game.error || null, tEnd: __game.kin.tEnd, V0: __game.kin.V0 }));
  console.log(JSON.stringify(st), 'wall', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log(logs.slice(0, 40).join('\n') || 'no console errors');
  await browser.close();
})();
