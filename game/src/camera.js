// The camera: a chase camera that sits behind and above the plane and leans
// with its bank, plus a slow orbit for the title screen. One job: where the
// pilot looks from, never fighting the plane.
import * as THREE from '../vendor/three.module.min.js';

/** Smoothly follow the plane from behind; `dt` in seconds. */
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, 40, 120);
    this.lookAt = new THREE.Vector3(0, 10, 0);
  }

  /** Follow the flight state; bank rolls the view slightly with the plane. */
  update(state, dt) {
    const backX = -Math.cos(state.heading);
    const backZ = Math.sin(state.heading);
    const dist = 26 + state.speed * 0.06;
    const height = 7 + state.speed * 0.02;
    const target = new THREE.Vector3(
      state.x + backX * dist,
      state.y + height,
      state.z + backZ * dist,
    );
    const k = Math.min(1, dt * 5);
    this.position.lerp(target, k);
    const look = new THREE.Vector3(
      state.x + Math.cos(state.heading) * 30,
      state.y + Math.sin(state.pitch) * 18,
      state.z - Math.sin(state.heading) * 30,
    );
    this.lookAt.lerp(look, Math.min(1, dt * 7));
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);
    // Lean the horizon with the bank: a little roll sells the turn.
    this.camera.rotateZ(state.bank * 0.35);
  }

  /** Slow orbit around a parked plane, for the title screen. */
  orbit(state, time) {
    const angle = time * 0.12;
    const radius = 40;
    this.camera.position.set(
      state.x + Math.cos(angle) * radius,
      state.y + 16 + Math.sin(time * 0.2) * 2,
      state.z + Math.sin(angle) * radius,
    );
    this.camera.lookAt(state.x, state.y + 1, state.z);
  }
}
