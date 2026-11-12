// First-person rig: look limits, walking, collision, head bob.
import { THREE, clamp, lerp, damp, angDiff, ease } from './util.js';

const V = new THREE.Vector3();

export class Player {
  constructor(G) {
    this.G = G;
    this.rig = new THREE.Object3D();
    this.rig.rotation.order = 'YXZ';
    this.cam = G.camera;
    this.cam.rotation.order = 'YXZ';
    this.rig.add(this.cam);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yawLim = null;
    this.pitchLim = [-1.3, 1.3];
    this.lookEnabled = false;
    this.moveEnabled = false;
    this.eye = 1.62;
    this.ground = 0;
    this.bounds = null;
    this.obstacles = [];
    this.stepPhase = 0;
    this.bobAmp = 0;
    this.head = new THREE.Vector3();
    this.headV = new THREE.Vector3();
    this.shake = 0;
    this.sens = 0.0023;
    this.auto = null;
    this.onStep = null;
    this.moved = 0;
    this.ranHint = false;
  }
  get pos() {
    return this.rig.position;
  }
  // Angles (in rig space) that point the camera at a world position.
  anglesTo(p) {
    this.rig.updateWorldMatrix(true, false);
    V.copy(p);
    this.rig.worldToLocal(V);
    V.sub(this.cam.position);
    return { yaw: Math.atan2(-V.x, -V.z), pitch: Math.atan2(V.y, Math.hypot(V.x, V.z)) };
  }
  lookAt(p, dur = 0.8, e = ease.io) {
    const a = this.anglesTo(p);
    return this.lookTo(a.yaw, a.pitch, dur, e);
  }
  lookTo(yaw, pitch, dur = 0.8, e = ease.io) {
    const y0 = this.yaw;
    const p0 = this.pitch;
    const dy = angDiff(y0, yaw);
    return this.G.dir.tween(dur, (k) => {
      this.yaw = y0 + dy * k;
      this.pitch = lerp(p0, pitch, k);
    }, e);
  }
  // Fold the rig's own heading into the look yaw so walking uses one angle.
  flatten() {
    this.yaw += this.rig.rotation.y;
    this.rig.rotation.set(0, 0, 0);
    this.yawLim = null;
  }
  bump(v) {
    this.headV.y -= v;
  }
  update(dt, t) {
    const inp = this.G.input;
    const [dx, dy] = inp.consume();
    if (this.lookEnabled) {
      this.yaw -= dx * this.sens;
      this.pitch -= dy * this.sens;
    }
    if (this.yawLim) this.yaw = clamp(this.yaw, this.yawLim[0], this.yawLim[1]);
    this.pitch = clamp(this.pitch, this.pitchLim[0], this.pitchLim[1]);

    let speed = 0;
    if (this.moveEnabled) {
      let f = inp.fwd;
      let s = inp.strafe;
      let wx = 0;
      let wz = 0;
      if (this.auto) {
        const ax = this.auto.x - this.pos.x;
        const az = this.auto.z - this.pos.z;
        const d = Math.hypot(ax, az);
        if (d > 0.15) {
          wx = ax / d;
          wz = az / d;
          this.yaw += angDiff(this.yaw, Math.atan2(-wx, -wz)) * (1 - Math.exp(-4 * dt));
        }
      } else if (f || s) {
        const sy = Math.sin(this.yaw);
        const cy = Math.cos(this.yaw);
        wx = -sy * f + cy * s;
        wz = -cy * f - sy * s;
        const l = Math.hypot(wx, wz);
        if (l > 1) {
          wx /= l;
          wz /= l;
        }
        if (inp.running && !this.ranHint) {
          this.ranHint = true;
          this.G.ui.toast('No running on campus.');
        }
      }
      const v = 2.3;
      let nx = this.pos.x + wx * v * dt;
      let nz = this.pos.z + wz * v * dt;
      for (const o of this.obstacles) {
        const cx = o.p ? o.p.x : o.x;
        const cz = o.p ? o.p.z : o.z;
        const ox = nx - cx;
        const oz = nz - cz;
        const d = Math.hypot(ox, oz);
        const r = o.r + 0.32;
        if (d < r && d > 0.0001) {
          nx = cx + (ox / d) * r;
          nz = cz + (oz / d) * r;
        }
      }
      if (this.bounds) {
        nx = clamp(nx, this.bounds.x0, this.bounds.x1);
        nz = clamp(nz, this.bounds.z0, this.bounds.z1);
      }
      speed = Math.hypot(nx - this.pos.x, nz - this.pos.z) / Math.max(dt, 1e-5);
      this.moved += speed * dt;
      this.pos.x = nx;
      this.pos.z = nz;
      this.pos.y = this.ground + this.eye;
    }
    // footsteps and bob
    const moving = speed > 0.4 || this.railSpeed > 0.4;
    const sp = Math.max(speed, this.railSpeed || 0);
    this.bobAmp = damp(this.bobAmp, moving ? 1 : 0, 8, dt);
    if (moving) {
      const before = Math.floor(this.stepPhase / Math.PI);
      this.stepPhase += dt * sp * 3.3;
      if (Math.floor(this.stepPhase / Math.PI) !== before && this.onStep) this.onStep();
    }
    // sprung head offset (speed bumps, landings)
    this.headV.addScaledVector(this.head, -120 * dt);
    this.headV.multiplyScalar(Math.exp(-11 * dt));
    this.head.addScaledVector(this.headV, dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake;
    this.cam.position.set(
      this.head.x + Math.cos(this.stepPhase * 0.5) * 0.018 * this.bobAmp,
      this.head.y + Math.abs(Math.sin(this.stepPhase)) * 0.034 * this.bobAmp,
      this.head.z
    );
    this.cam.rotation.set(
      this.pitch + Math.sin(t * 47) * 0.02 * sh,
      this.yaw + Math.sin(t * 39 + 1) * 0.02 * sh,
      this.roll + Math.sin(this.stepPhase * 0.5) * 0.004 * this.bobAmp + Math.sin(t * 53) * 0.012 * sh
    );
  }
}
