// Loads the built page headlessly, reports console errors, saves a title shot.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.env.SHOTS || path.join(__dirname, '..', 'shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?debug');
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const G = window.__game;
    if (!G) return { none: true };
    return { phase: G.phase, tEnd: G.kin && G.kin.tEnd, V0: G.kin && G.kin.V0, startS: G.kin && G.kin.startS, L: G.path && G.path.L, sStop: G.path && G.path.sStop, sWake: G.path && G.path.sWake, world: !!G.world, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: path.join(out, '00-title.png') });
  console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
