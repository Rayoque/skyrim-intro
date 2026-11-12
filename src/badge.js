// The badge and its regrettable photo, drawn on a 2D canvas.
export const SKINS = ['#f3d2b8', '#e6b894', '#cf9a72', '#b07a52', '#8a5a3c', '#5e3d2a'];
export const HAIRS = ['#1b1612', '#4a3222', '#8a4a22', '#d9b25a', '#b9b4ae', '#1f9aa0'];
export const HAIR_STYLES = ['Short', 'Bob', 'Bun', 'Curly', 'Long', 'None'];
export const LANYARDS = ['#1f9aa0', '#f2c230', '#b23a48', '#3b5f8a', '#2a2c30'];
export const DEPTS = [
  { n: 'Paper', d: 'The original business. Smells like a library. Perk: paper cuts heal 10% faster.' },
  { n: 'Cloud', d: "Runs on somebody else's chips. Perk: nobody asks what you do." },
  { n: 'Paper-to-Cloud', d: 'You scan things, then you shred them. Perk: immune to toner.' },
  { n: 'Synergy', d: 'A department about departments. Perk: may circle back twice a day.' },
  { n: 'Facilities', d: 'Doors, bulbs, geese. Perk: geese notice you last.' },
  { n: 'Undetermined', d: 'Someone will tell you. Probably. Perk: no meetings yet.' },
];
export const SMILES = ['Legally neutral', 'Polite', 'Approachable', 'Team player', 'Trying too hard'];

export function defaultBadge() {
  return { name: '', dept: 1, skin: 1, hair: 4, hairStyle: 0, lanyard: 4, glasses: true, smile: 62 };
}
export const badgeName = (s) => (s.name && s.name.trim()) || 'New Hire';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
function ell(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function avatar(g, x, y, w, h, s, final) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const bg = g.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#c9d8dc');
  bg.addColorStop(1, '#a7bbc1');
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  const u = w / 300;
  let cx = x + w / 2;
  let cy = y + h * 0.47;
  if (final) {
    cx += 38 * u;
    cy -= 40 * u;
    g.translate(cx, cy);
    g.rotate(-0.08);
    g.translate(-cx, -cy);
  }
  const skin = SKINS[s.skin];
  const hair = HAIRS[s.hair];
  const st = s.hairStyle;
  // hair behind the head
  g.fillStyle = hair;
  if (st === 1) {
    rrect(g, cx - 98 * u, cy - 96 * u, 196 * u, 190 * u, 70 * u);
    g.fill();
  } else if (st === 4) {
    rrect(g, cx - 100 * u, cy - 96 * u, 200 * u, 300 * u, 70 * u);
    g.fill();
  } else if (st === 3) {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      ell(g, cx + Math.cos(a) * 80 * u, cy - 12 * u + Math.sin(a) * 84 * u, 30 * u, 30 * u);
    }
  } else if (st === 2) {
    ell(g, cx, cy - 112 * u, 32 * u, 30 * u);
  }
  // shoulders, shirt, lanyard
  // a black leather jacket, zipped most of the way
  g.fillStyle = '#17181b';
  ell(g, cx, cy + 215 * u, 160 * u, 100 * u);
  g.fillStyle = '#2a2c31';
  g.beginPath();
  g.moveTo(cx - 34 * u, cy + 116 * u);
  g.lineTo(cx + 34 * u, cy + 116 * u);
  g.lineTo(cx, cy + 172 * u);
  g.fill();
  g.fillStyle = '#0e0f11';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sx * 34 * u, cy + 112 * u);
    g.lineTo(cx + sx * 78 * u, cy + 128 * u);
    g.lineTo(cx + sx * 6 * u, cy + 190 * u);
    g.fill();
  }
  g.strokeStyle = '#c3c8ce';
  g.lineWidth = 4 * u;
  g.beginPath();
  g.moveTo(cx, cy + 176 * u);
  g.lineTo(cx, cy + 300 * u);
  g.stroke();
  g.strokeStyle = LANYARDS[s.lanyard];
  g.lineWidth = 10 * u;
  g.beginPath();
  g.moveTo(cx - 56 * u, cy + 122 * u);
  g.lineTo(cx, cy + 206 * u);
  g.lineTo(cx + 56 * u, cy + 122 * u);
  g.stroke();
  // neck, head, ears
  g.fillStyle = shade(skin, -26);
  rrect(g, cx - 27 * u, cy + 60 * u, 54 * u, 68 * u, 16 * u);
  g.fill();
  g.fillStyle = skin;
  ell(g, cx - 78 * u, cy + 6 * u, 12 * u, 20 * u);
  ell(g, cx + 78 * u, cy + 6 * u, 12 * u, 20 * u);
  ell(g, cx, cy, 78 * u, 94 * u);
  // hair on top
  g.fillStyle = hair;
  if (st !== 5) {
    g.beginPath();
    g.ellipse(cx, cy - 16 * u, 83 * u, 84 * u, 0, Math.PI, 0);
    g.quadraticCurveTo(cx + 70 * u, cy - 44 * u, cx + 22 * u, cy - 52 * u);
    g.quadraticCurveTo(cx - 30 * u, cy - 62 * u, cx - 83 * u, cy - 16 * u);
    g.fill();
    if (st === 3) for (let i = 0; i < 7; i++) ell(g, cx - 66 * u + i * 22 * u, cy - 74 * u - Math.sin(i * 0.52) * 16 * u, 22 * u, 22 * u);
  } else {
    g.fillStyle = 'rgba(255,255,255,0.22)';
    ell(g, cx - 24 * u, cy - 62 * u, 26 * u, 12 * u);
  }
  // brows
  g.strokeStyle = st === 5 ? shade(skin, -70) : hair === '#d9b25a' || hair === '#b9b4ae' ? shade(hair, -60) : hair;
  g.lineWidth = 6 * u;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 46 * u, cy - 30 * u - (final ? 9 * u : 0));
  g.lineTo(cx - 16 * u, cy - 33 * u - (final ? 3 * u : 0));
  g.moveTo(cx + 16 * u, cy - 33 * u);
  g.lineTo(cx + 46 * u, cy - 30 * u);
  g.stroke();
  // eyes
  const eye = (ex, mode) => {
    if (mode === 'open') {
      g.fillStyle = '#ffffff';
      ell(g, ex, cy - 8 * u, 14 * u, 10 * u);
      g.fillStyle = '#3a2a1e';
      ell(g, ex, cy - 8 * u, 6.5 * u, 6.5 * u);
      g.fillStyle = '#ffffff';
      ell(g, ex + 2.5 * u, cy - 10.5 * u, 2 * u, 2 * u);
    } else if (mode === 'half') {
      g.fillStyle = '#ffffff';
      ell(g, ex, cy - 6 * u, 14 * u, 9 * u);
      g.fillStyle = '#3a2a1e';
      ell(g, ex - 2 * u, cy - 2 * u, 6 * u, 6 * u);
      g.fillStyle = skin;
      g.fillRect(ex - 17 * u, cy - 19 * u, 34 * u, 12 * u);
      g.strokeStyle = shade(skin, -70);
      g.lineWidth = 3 * u;
      g.beginPath();
      g.moveTo(ex - 15 * u, cy - 7 * u);
      g.lineTo(ex + 15 * u, cy - 7 * u);
      g.stroke();
    } else {
      g.strokeStyle = shade(skin, -80);
      g.lineWidth = 4 * u;
      g.beginPath();
      g.moveTo(ex - 14 * u, cy - 8 * u);
      g.quadraticCurveTo(ex, cy - 1 * u, ex + 14 * u, cy - 8 * u);
      g.stroke();
    }
  };
  eye(cx - 31 * u, final ? 'shut' : 'open');
  eye(cx + 31 * u, final ? 'half' : 'open');
  // nose
  g.strokeStyle = shade(skin, -46);
  g.lineWidth = 4 * u;
  g.beginPath();
  g.moveTo(cx + 2 * u, cy + 2 * u);
  g.quadraticCurveTo(cx + 12 * u, cy + 24 * u, cx - 3 * u, cy + 26 * u);
  g.stroke();
  // mouth
  if (final) {
    g.fillStyle = '#5c1f24';
    ell(g, cx + 6 * u, cy + 54 * u, 19 * u, 15 * u);
    g.fillStyle = '#f4efe6';
    g.fillRect(cx - 9 * u, cy + 40 * u, 30 * u, 6 * u);
    g.fillStyle = '#c0626a';
    ell(g, cx + 8 * u, cy + 62 * u, 10 * u, 5 * u);
  } else {
    const k = (s.smile - 50) / 50;
    if (s.smile > 78) {
      g.fillStyle = '#f7f3ea';
      g.strokeStyle = '#5c1f24';
      g.lineWidth = 3.5 * u;
      g.beginPath();
      g.moveTo(cx - 30 * u, cy + 42 * u);
      g.quadraticCurveTo(cx, cy + 50 * u, cx + 30 * u, cy + 42 * u);
      g.quadraticCurveTo(cx, cy + 42 * u + k * 40 * u, cx - 30 * u, cy + 42 * u);
      g.fill();
      g.stroke();
    } else {
      g.strokeStyle = '#7a2e36';
      g.lineWidth = 5 * u;
      g.beginPath();
      g.moveTo(cx - 25 * u, cy + 46 * u - k * 4 * u);
      g.quadraticCurveTo(cx, cy + 46 * u + k * 22 * u, cx + 25 * u, cy + 46 * u - k * 4 * u);
      g.stroke();
    }
  }
  if (s.glasses) {
    g.strokeStyle = '#22262b';
    g.lineWidth = 5 * u;
    for (const sx of [-1, 1]) {
      rrect(g, cx + sx * 31 * u - 21 * u, cy - 24 * u, 42 * u, 32 * u, 9 * u);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - 10 * u, cy - 10 * u);
    g.lineTo(cx + 10 * u, cy - 10 * u);
    g.stroke();
    if (final) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.moveTo(cx - 50 * u, cy - 4 * u);
      g.lineTo(cx - 26 * u, cy - 22 * u);
      g.lineTo(cx - 14 * u, cy - 22 * u);
      g.lineTo(cx - 44 * u, cy + 6 * u);
      g.fill();
    }
  }
  g.restore();
  if (final) {
    // camera flash hotspot
    const fl = g.createRadialGradient(x + w * 0.2, y + h * 0.18, 0, x + w * 0.2, y + h * 0.18, w * 0.6);
    fl.addColorStop(0, 'rgba(255,255,255,0.5)');
    fl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fl;
    g.fillRect(x, y, w, h);
  }
}

export function drawBadge(cv, s, final = false) {
  const g = cv.getContext('2d');
  const W = 600;
  const H = 840;
  g.save();
  g.clearRect(0, 0, cv.width, cv.height);
  g.scale(cv.width / W, cv.height / H);
  g.fillStyle = '#fbfaf5';
  rrect(g, 0, 0, W, H, 34);
  g.fill();
  g.save();
  rrect(g, 0, 0, W, H, 34);
  g.clip();
  g.fillStyle = '#17797e';
  g.fillRect(0, 0, W, 150);
  g.fillStyle = '#f2c230';
  g.fillRect(0, 150, W, 10);
  g.restore();
  g.fillStyle = '#0b1213';
  rrect(g, W / 2 - 46, 22, 92, 22, 11);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 44px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
  g.fillText('WEXCOMBE', W / 2, 84);
  g.font = '500 21px "IBM Plex Mono", Menlo, Consolas, monospace';
  g.fillText('P A P E R   &   C L O U D', W / 2, 124);

  avatar(g, 150, 190, 300, 330, s, final);
  g.strokeStyle = '#1a2b2c';
  g.lineWidth = 4;
  g.strokeRect(150, 190, 300, 330);

  const name = badgeName(s);
  let size = 62;
  g.fillStyle = '#1a2b2c';
  g.font = `700 ${size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(name).width > 520 && size > 26) {
    size -= 2;
    g.font = `700 ${size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  }
  g.fillText(name, W / 2, 580);
  g.fillStyle = '#17797e';
  g.font = '600 27px "IBM Plex Mono", Menlo, Consolas, monospace';
  g.fillText(DEPTS[s.dept].n.toUpperCase(), W / 2, 634);

  g.fillStyle = '#f2c230';
  rrect(g, W / 2 - 96, 668, 192, 46, 8);
  g.fill();
  g.fillStyle = '#2a2204';
  g.font = '700 25px "IBM Plex Mono", Menlo, Consolas, monospace';
  g.fillText('NEW HIRE', W / 2, 692);

  // barcode from the name
  let hsh = 7;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  g.fillStyle = '#1a2b2c';
  let bx = 60;
  for (let i = 0; i < 44 && bx < 300; i++) {
    hsh = (hsh * 1103515245 + 12345) >>> 0;
    const bw = 2 + ((hsh >> 16) % 4) * 2;
    if (i % 2 === 0) g.fillRect(bx, 744, bw, 56);
    bx += bw;
  }
  g.textAlign = 'right';
  g.fillStyle = '#51625f';
  g.font = '500 19px "IBM Plex Mono", Menlo, Consolas, monospace';
  g.fillText('ID: PENDING', 546, 758);
  g.fillText('VALID: TODAY', 546, 786);
  g.restore();
}
