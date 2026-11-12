// DOM overlay: fades, eyelids, subtitles, the badge kiosk, choices, end card.
import { clamp } from './util.js';
import { drawBadge, defaultBadge, DEPTS, SKINS, HAIRS, HAIR_STYLES, LANYARDS, SMILES } from './badge.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(G) {
    this.G = G;
    this.fade = 0;
    this.lid = 1; // 1 = eyes open
    this.blur = 0;
    this.bars = 0;
    this.flash = 0;
    this.stampA = 0;
    this._last = {};
    this.el = {};
    for (const id of ['subBox', 'c', 'fade', 'lidT', 'lidB', 'flash', 'barT', 'barB', 'stamp', 'stamp1', 'stamp2', 'objective', 'hudBadge', 'subName', 'subText', 'hint', 'toast', 'corner', 'muteBtn', 'ffBtn', 'creator', 'choices', 'choicePrompt', 'choiceList', 'end', 'start', 'startBtn', 'dbg']) this.el[id] = $(id);
    this.badge = defaultBadge();
    this._toastT = 0;

    const ff = this.el.ffBtn;
    const on = (e) => {
      e.preventDefault();
      G.input.ffBtn = true;
      ff.classList.add('on');
    };
    const offFn = () => {
      G.input.ffBtn = false;
      ff.classList.remove('on');
    };
    ff.addEventListener('pointerdown', on);
    ff.addEventListener('pointerup', offFn);
    ff.addEventListener('pointerleave', offFn);
    ff.addEventListener('pointercancel', offFn);
    this.el.muteBtn.addEventListener('click', () => G.toggleMute());
  }
  setMuteLabel(m) {
    this.el.muteBtn.textContent = m ? 'Sound off' : 'Sound on';
  }
  // Push animated values to the DOM, only when they change.
  apply(dtReal) {
    const L = this._last;
    const set = (k, v, fn) => {
      const r = Math.round(v * 1000) / 1000;
      if (L[k] !== r) {
        L[k] = r;
        fn(r);
      }
    };
    set('fade', this.fade, (v) => (this.el.fade.style.opacity = v));
    set('flash', this.flash, (v) => (this.el.flash.style.opacity = v));
    set('lid', this.lid, (v) => {
      const o = clamp(v, 0, 1) * 130;
      this.el.lidT.style.transform = `translateY(${-o}%)`;
      this.el.lidB.style.transform = `translateY(${o}%)`;
    });
    set('blur', this.blur, (v) => (this.el.c.style.filter = v > 0.05 ? `blur(${v}px)` : ''));
    set('bars', this.bars, (v) => {
      this.el.barT.style.transform = `translateY(${-(1 - v) * 100}%)`;
      this.el.barB.style.transform = `translateY(${(1 - v) * 100}%)`;
    });
    set('stamp', this.stampA, (v) => (this.el.stamp.style.opacity = v));
    if (this._toastT > 0) {
      this._toastT -= dtReal;
      if (this._toastT <= 0) this.el.toast.hidden = true;
    }
  }
  stamp(a, b = '') {
    this.el.stamp1.textContent = a;
    this.el.stamp2.textContent = b;
  }
  sub(name, color, text, whisper = false) {
    this.el.subName.textContent = name;
    this.el.subName.style.color = color;
    this.el.subText.textContent = text;
    this.el.subText.classList.toggle('whisper', whisper);
    this.el.subBox.hidden = false;
  }
  subText(text) {
    this.el.subText.textContent = text;
  }
  clearSub() {
    this.el.subName.textContent = '';
    this.el.subText.textContent = '';
    this.el.subBox.hidden = true;
  }
  objective(text) {
    this.el.objective.hidden = !text;
    if (text) this.el.objective.textContent = text;
  }
  hint(text) {
    this.el.hint.textContent = text || '';
  }
  toast(text, dur = 3.5) {
    this.el.toast.textContent = text;
    this.el.toast.hidden = false;
    this._toastT = dur;
  }
  showHud(on) {
    this.el.corner.hidden = !on;
  }
  hudBadge(state) {
    drawBadge(this.el.hudBadge, state, true);
    this.el.hudBadge.hidden = false;
  }

  // ---- badge kiosk -------------------------------------------------------
  creator(auto = false) {
    const G = this.G;
    const s = this.badge;
    const el = this.el.creator;
    const cv = $('badgeCanvas');
    const redraw = () => drawBadge(cv, s, false);
    const swatches = (id, list, key) => {
      const box = $(id);
      box.textContent = '';
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.background = c;
        b.setAttribute('aria-label', `${key} ${i + 1}`);
        b.setAttribute('aria-pressed', String(s[key] === i));
        b.addEventListener('click', () => {
          s[key] = i;
          for (const o of box.children) o.setAttribute('aria-pressed', 'false');
          b.setAttribute('aria-pressed', 'true');
          G.snd.click();
          redraw();
        });
        box.appendChild(b);
      });
    };
    swatches('sw-skin', SKINS, 'skin');
    swatches('sw-hair', HAIRS, 'hair');
    swatches('sw-lanyard', LANYARDS, 'lanyard');
    const dept = () => {
      $('dept-name').textContent = DEPTS[s.dept].n;
      $('dept-desc').textContent = DEPTS[s.dept].d;
    };
    const hair = () => ($('hair-name').textContent = HAIR_STYLES[s.hairStyle]);
    const smile = () => ($('smile-label').textContent = SMILES[Math.min(4, Math.floor(s.smile / 20.01))]);
    const cyc = (id, key, n, d, fn) => {
      $(id).onclick = () => {
        s[key] = (s[key] + d + n) % n;
        G.snd.click();
        fn();
        redraw();
      };
    };
    cyc('dept-prev', 'dept', DEPTS.length, -1, dept);
    cyc('dept-next', 'dept', DEPTS.length, 1, dept);
    cyc('hair-prev', 'hairStyle', HAIR_STYLES.length, -1, hair);
    cyc('hair-next', 'hairStyle', HAIR_STYLES.length, 1, hair);
    const nameEl = $('f-name');
    nameEl.value = s.name;
    nameEl.oninput = () => {
      s.name = nameEl.value;
      redraw();
    };
    const gl = $('f-glasses');
    gl.checked = s.glasses;
    gl.onchange = () => {
      s.glasses = gl.checked;
      G.snd.click();
      redraw();
    };
    const sm = $('f-smile');
    sm.value = s.smile;
    sm.oninput = () => {
      s.smile = +sm.value;
      smile();
      redraw();
    };
    dept();
    hair();
    smile();
    redraw();
    $('kioskEdit').hidden = false;
    $('kioskDone').hidden = true;
    el.hidden = false;

    return new Promise((res) => {
      const btn = $('takePhoto');
      btn.disabled = false;
      btn.textContent = 'Take photo';
      let busy = false;
      const shoot = () => {
        if (busy) return;
        busy = true;
        btn.disabled = true;
        btn.textContent = 'Hold still. Three…';
        setTimeout(() => (btn.textContent = 'Two…'), auto ? 80 : 700);
        setTimeout(() => {
          G.snd.shutter();
          this.flash = 1;
          G.dir.to(this, { flash: 0 }, 0.9);
          drawBadge($('badgeFinal'), s, true);
          $('kioskEdit').hidden = true;
          $('kioskDone').hidden = false;
          G.snd.printer();
          if (G.onPhoto) G.onPhoto();
          if (auto) setTimeout(done, 300);
        }, auto ? 160 : 1150);
      };
      const done = () => {
        el.hidden = true;
        this.hudBadge(s);
        res(s);
      };
      $('creatorForm').onsubmit = (e) => {
        e.preventDefault();
        shoot();
      };
      $('clipOn').onclick = () => {
        G.snd.click();
        done();
      };
      if (auto) setTimeout(shoot, 250);
    });
  }

  // ---- reply choices -----------------------------------------------------
  choose(prompt, options, auto = false) {
    const el = this.el.choices;
    this.el.choicePrompt.textContent = prompt;
    const list = this.el.choiceList;
    list.textContent = '';
    return new Promise((res) => {
      let done = false;
      const pick = (i) => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', key);
        el.hidden = true;
        this.G.snd.click();
        res(i);
      };
      const key = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) pick(n - 1);
      };
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        const num = document.createElement('span');
        num.textContent = String(i + 1);
        b.append(num, document.createTextNode(o));
        b.addEventListener('click', () => pick(i));
        list.appendChild(b);
      });
      document.addEventListener('keydown', key);
      el.hidden = false;
      if (auto) setTimeout(() => pick(0), 400);
    });
  }

  end(facts) {
    drawBadge($('badgeEnd'), this.badge, true);
    $('statFacts').textContent = String(facts);
    this.el.end.hidden = false;
    this.el.corner.hidden = true;
    this.el.hudBadge.hidden = true;
    this.objective(null);
    $('againBtn').onclick = () => location.reload();
  }
}
