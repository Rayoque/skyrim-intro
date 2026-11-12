// Game-time scheduler. Cutscenes are written as async functions that await
// waits, tweens and conditions; all of them run on game time, so pausing and
// fast-forward work for free.
import { ease } from './util.js';

export class Director {
  constructor() {
    this.t = 0;
    this.timers = [];
    this.tweens = [];
    this.conds = [];
  }
  update(dt) {
    this.t += dt;
    if (this.tweens.length) {
      const live = [];
      for (const tw of this.tweens) {
        tw.e += dt;
        const k = tw.d <= 0 ? 1 : Math.min(1, tw.e / tw.d);
        tw.fn(tw.ease(k), k);
        if (k >= 1) tw.res();
        else live.push(tw);
      }
      this.tweens = live;
    }
    if (this.timers.length) {
      const live = [];
      for (const tm of this.timers) {
        if (this.t >= tm.t) tm.res();
        else live.push(tm);
      }
      this.timers = live;
    }
    if (this.conds.length) {
      const live = [];
      for (const c of this.conds) {
        if (c.fn()) c.res();
        else live.push(c);
      }
      this.conds = live;
    }
  }
  wait(s) {
    return new Promise((res) => this.timers.push({ t: this.t + s, res }));
  }
  at(t) {
    return new Promise((res) => this.timers.push({ t, res }));
  }
  until(fn) {
    return new Promise((res) => this.conds.push({ fn, res }));
  }
  tween(d, fn, e = ease.io) {
    return new Promise((res) => this.tweens.push({ e: 0, d, fn, ease: e, res }));
  }
  to(obj, props, d, e = ease.io) {
    const from = {};
    for (const k in props) from[k] = obj[k];
    return this.tween(d, (k) => {
      for (const key in props) obj[key] = from[key] + (props[key] - from[key]) * k;
    }, e);
  }
}
