// Bundles src/ into one self-contained index.html (three.js inlined) so the
// game runs by double-clicking the file. `--page <path>` also writes a
// body-fragment variant that loads three.js from a CDN.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const THREE_VERSION = JSON.parse(fs.readFileSync('node_modules/three/package.json', 'utf8')).version;
const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
// If the 3D library is missing, say so instead of failing silently.
const guard = `if(!window.THREE){document.querySelector('.lede').textContent='The 3D library did not load. Check the connection and reload.';document.getElementById('startBtn').disabled=true}else{`;
const game = esc(guard + out.outputFiles[0].text + '}');
const three = esc(fs.readFileSync('node_modules/three/build/three.min.js', 'utf8'));
const css = fs.readFileSync('src/style.css', 'utf8');
const tpl = fs.readFileSync('src/template.html', 'utf8').replace('/*__CSS__*/', () => css);

const cut = tpl.indexOf('<div id="game">');
const head = tpl.slice(0, cut);
const body = tpl.slice(cut);
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}</head>
<body>
${body.replace('<!--__SCRIPTS__-->', () => `<script>${three}</script>\n<script>${game}</script>`)}</body>
</html>
`;
fs.writeFileSync('index.html', standalone);
console.log(`index.html  ${(standalone.length / 1024).toFixed(0)} KB  (three ${THREE_VERSION})`);

const i = process.argv.indexOf('--page');
if (i > 0 && process.argv[i + 1]) {
  const cdn = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`;
  const page = tpl.replace('<!--__SCRIPTS__-->', () => `<script src="${cdn}"></script>\n<script>${game}</script>`);
  fs.mkdirSync(path.dirname(process.argv[i + 1]), { recursive: true });
  fs.writeFileSync(process.argv[i + 1], page);
  console.log(`${process.argv[i + 1]}  ${(page.length / 1024).toFixed(0)} KB`);
}
