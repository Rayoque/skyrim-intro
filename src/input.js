// Mouse (pointer lock or drag), touch (drag to look, left-thumb stick) and keys.
import { clamp } from './util.js';

export class Input {
  constructor(canvas, G) {
    this.c = canvas;
    this.G = G;
    this.keys = new Set();
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.wantLock = true;
    this.dragging = false;
    this.uiMode = true;
    this.ffKey = false;
    this.ffBtn = false;
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.lookId = null;
    this.lx = 0;
    this.ly = 0;
    this.touch = false;
    this.joyEl = document.getElementById('joy');
    this.knobEl = document.getElementById('joyKnob');

    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.ffKey = true;
      if (e.code === 'KeyM' && !e.repeat) G.toggleMute();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') this.ffKey = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.ffKey = false;
      this.dragging = false;
    });

    canvas.addEventListener('mousedown', () => {
      this.dragging = true;
      if (!this.uiMode && this.wantLock && !this.locked) this.tryLock();
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    document.addEventListener('mousemove', (e) => {
      if (this.uiMode) return;
      if (this.locked) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      } else if (this.dragging) {
        this.dx += e.movementX * 1.7;
        this.dy += e.movementY * 1.7;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('pointerlockerror', () => {
      this.wantLock = false;
    });

    const opt = { passive: false };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touch = true;
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.42 && t.clientY > window.innerHeight * 0.35;
        if (left && this.joy.id === null && G.player && G.player.moveEnabled) {
          this.joy.id = t.identifier;
          this.joy.ox = t.clientX;
          this.joy.oy = t.clientY;
          this.joyEl.style.left = t.clientX + 'px';
          this.joyEl.style.top = t.clientY + 'px';
          this.joyEl.classList.add('on');
          this.knobEl.style.transform = 'translate(-50%,-50%)';
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lx = t.clientX;
          this.ly = t.clientY;
        }
      }
    }, opt);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          const R = 52;
          let x = t.clientX - this.joy.ox;
          let y = t.clientY - this.joy.oy;
          const l = Math.hypot(x, y);
          if (l > R) {
            x *= R / l;
            y *= R / l;
          }
          this.joy.x = x / R;
          this.joy.y = y / R;
          this.knobEl.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        } else if (t.identifier === this.lookId) {
          if (!this.uiMode) {
            this.dx += (t.clientX - this.lx) * 2.2;
            this.dy += (t.clientY - this.ly) * 2.2;
          }
          this.lx = t.clientX;
          this.ly = t.clientY;
        }
      }
    }, opt);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) this.releaseJoy();
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }
  releaseJoy() {
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    this.joyEl.classList.remove('on');
  }
  tryLock() {
    try {
      const p = this.c.requestPointerLock && this.c.requestPointerLock();
      if (p && p.catch) p.catch(() => (this.wantLock = false));
    } catch (e) {
      this.wantLock = false;
    }
  }
  // UI mode frees the cursor for panels and stops look input.
  setUI(on) {
    this.uiMode = on;
    if (on) {
      this.releaseJoy();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }
  get ff() {
    return this.ffKey || this.ffBtn;
  }
  get fwd() {
    const k = this.keys;
    return clamp((k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.joy.y, -1, 1);
  }
  get strafe() {
    const k = this.keys;
    return clamp((k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.joy.x, -1, 1);
  }
  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
  consume() {
    const r = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return r;
  }
}
