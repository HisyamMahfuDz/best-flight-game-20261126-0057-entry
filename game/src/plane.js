// The aircraft: an original bush plane built from primitives, and the arcade
// flight model — throttle, bank, pitch, stall, fuel, damage, landings, crashes.
import * as THREE from '../vendor/three.module.min.js';
import { PLANE, RUNWAY, STRIPS, LOADOUTS } from './config.js';
import { heightAt, isWater } from './world.js';

/** Build the Kestrel-9 bush plane: fuselage, high wing, tail, floats, prop. */
export function buildPlaneMesh() {
  const plane = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8522e, metalness: 0.35, roughness: 0.5 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e8d8, metalness: 0.2, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.4, roughness: 0.5 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 7.5, 12), paint);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 12), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.8;
  plane.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), new THREE.MeshPhongMaterial({
    color: 0x9fd8ef, shininess: 120, transparent: true, opacity: 0.9,
  }));
  canopy.scale.set(0.9, 0.75, 1.6);
  canopy.position.set(0, 0.85, -0.6);
  plane.add(canopy);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 2.4), cream);
  wing.position.set(0, 0.9, -0.4);
  plane.add(wing);
  const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.3, 0.5), paint);
  wingStripe.position.set(0, 0.92, -1.4);
  plane.add(wingStripe);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 1.6), cream);
  tailWing.position.set(0, 0.5, 3.4);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 1.8), paint);
  fin.position.set(0, 1.3, 3.5);
  plane.add(fin);
  // Twin floats for water landings on the lagoon.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 5.4, 10), dark);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 1.5, -1.35, -0.4);
    plane.add(float);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), dark);
    strut.position.set(side * 1.5, -0.7, -0.4);
    plane.add(strut);
  }
  // Spinning propeller.
  const prop = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.35, 4.6, 0.12);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1);
  prop.add(blade2);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), cream);
  prop.add(hub);
  prop.position.z = -6.1;
  plane.add(prop);
  plane.userData.prop = prop;
  return plane;
}

/** Which strip (if any) the point is over, for landing checks. */
function stripAt(x, z) {
  const strips = [RUNWAY, ...STRIPS];
  for (const strip of strips) {
    const heading = (strip.headingDeg * Math.PI) / 180;
    const dx = x - strip.x;
    const dz = z - strip.z;
    const along = dx * Math.sin(heading) - dz * Math.cos(heading);
    const across = dx * Math.cos(heading) + dz * Math.sin(heading);
    if (Math.abs(along) <= strip.length / 2 && Math.abs(across) <= strip.width / 2) return strip;
  }
  return null;
}

/** Pilot state: position, attitude, throttle, fuel, damage, gear. */
export class FlightState {
  constructor(loadoutId = 'swift') {
    const loadout = LOADOUTS.find((item) => item.id === loadoutId) || LOADOUTS[0];
    this.loadout = loadout;
    this.reset();
  }

  reset() {
    this.x = -60;
    this.y = RUNWAY.height + 1.6; // parked on the strip, not floating above it
    this.z = RUNWAY.z;
    this.heading = 0; // east, along the main runway
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = 100 * this.loadout.fuelMul;
    this.fuelMax = 100 * this.loadout.fuelMul;
    this.damage = 0;
    this.gearDown = true;
    this.onGround = true;
    this.crashed = false;
    this.landedStrip = null;
    this.verticalSpeed = 0;
    this.boosting = false;
    this.flightTime = 0;
  }

  /** Knots for the HUD (1 m/s ≈ 1.94 kt). */
  get knots() {
    return Math.round(this.speed * 1.944);
  }

  /** Altitude above sea level, feet. */
  get altitudeFt() {
    return Math.round(this.y * 3.281);
  }

  /** Heading in degrees, 0 = north. */
  get headingDeg() {
    const deg = ((Math.PI / 2 - this.heading) * 180) / Math.PI;
    return ((Math.round(deg) % 360) + 360) % 360;
  }
}

/**
 * Advance the flight model one step. `steer` is -1..1 (bank), `pitchIn` is
 * -1..1 (elevator), `throttleIn` -1..1, `boost` true while Space is held.
 * Returns an event string: 'landed' | 'crashed' | 'ditched' | 'fuel-out' | ''.
 */
export function stepFlight(state, dt, steer, pitchIn, throttleIn, boost) {
  if (state.crashed) return 'crashed';
  const loadout = state.loadout;
  state.throttle = Math.max(0, Math.min(1, state.throttle + throttleIn * PLANE.throttleRate * dt));
  const maxSpeed = PLANE.maxSpeed * loadout.speedMul;
  state.boosting = boost && state.fuel > 0 && state.speed > 10;
  const targetSpeed = state.throttle * maxSpeed * (state.boosting ? PLANE.boostFactor : 1);
  const accel = state.onGround ? 14 : 9;
  state.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - state.speed));

  // Bank toward the stick, then ease back to level when released.
  const targetBank = steer * PLANE.maxBank;
  state.bank += (targetBank - state.bank) * Math.min(1, dt * 3.2);
  state.heading += -state.bank * PLANE.turnRate * dt * (state.speed / maxSpeed + 0.25);
  // Pitch: elevator input, plus a gentle stall drop and ground effect.
  const targetPitch = pitchIn * PLANE.maxPitch;
  state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 2.6);
  if (state.speed < PLANE.stallSpeed && !state.onGround) {
    state.pitch -= (PLANE.stallSpeed - state.speed) * 0.004 * dt * 60 * 0.02;
  }

  const prevY = state.y;
  const forwardX = Math.cos(state.heading);
  const forwardZ = -Math.sin(state.heading);
  state.x += forwardX * state.speed * dt;
  state.z += forwardZ * state.speed * dt;
  // While rolling on the ground the plane stays glued to the surface: the
  // pitch-climb and the stall sink apply only in the air. (Applying the
  // climb on the ground let y creep a hair above the contact threshold each
  // step, which flickered the plane airborne and re-fired 'landed' dozens
  // of times during a takeoff roll.)
  if (!state.onGround) {
    state.y += Math.sin(state.pitch) * state.speed * dt;
    if (state.speed < PLANE.stallSpeed) {
      state.y -= (PLANE.stallSpeed - state.speed) * 0.35 * dt;
    }
  }
  state.verticalSpeed = (state.y - prevY) / dt;
  state.flightTime += dt;

  // Fuel: throttle burn, plus boost burn; empty tank means gliding only.
  if (state.throttle > 0) {
    state.fuel -= PLANE.fuelBurn * state.throttle * dt * (state.boosting ? 1 + PLANE.boostBurn : 1);
  }
  if (state.fuel <= 0) {
    state.fuel = 0;
    state.throttle = 0;
    if (!state.onGround) return 'fuel-out';
  }

  // World edge: turn the plane back with a warning instead of a wall.
  const limit = 1450;
  if (Math.abs(state.x) > limit || Math.abs(state.z) > limit) {
    state.heading += Math.PI;
    state.x = Math.max(-limit, Math.min(limit, state.x));
    state.z = Math.max(-limit, Math.min(limit, state.z));
  }

  // Ground / water contact.
  const ground = heightAt(state.x, state.z);
  const clearance = state.y - ground;
  if (clearance <= 1.6) {
    // Takeoff: enough speed and a raised nose lifts the plane off the ground.
    // (Without this the ground clamp below would pin a rolling plane forever.)
    if (state.onGround && state.speed > PLANE.stallSpeed + 6 && state.pitch > 0.06) {
      state.onGround = false;
      state.y = ground + 1.7;
      state.landedStrip = null;
      return '';
    }
    state.y = ground + 1.6;
    const strip = stripAt(state.x, state.z);
    const sinkRate = -state.verticalSpeed;
    // A strip's heading in degrees converts to our heading variable as
    // h = 90deg - stripHeading; sin() of the difference covers both directions.
    const stripHeading = Math.PI / 2 - (strip ? (strip.headingDeg * Math.PI) / 180 : 0);
    const aligned = strip
      ? Math.abs(Math.sin(state.heading - stripHeading)) < 0.5
      : false;
    const wasAirborne = !state.onGround;
    if (strip && state.gearDown && state.speed < 55 && sinkRate < 9 && aligned) {
      // On a strip: a touchdown (was airborne) or a roll (was already down).
      // Brakes bite only when the pilot is not powering up — otherwise a
      // takeoff roll could never build speed (the old code braked at 26/s
      // against 14/s of thrust and pinned the plane on the runway forever).
      // The nose is levelled only on a real touchdown, so a pilot holding
      // the stick back can rotate for takeoff while still rolling.
      state.onGround = true;
      const braking = state.throttle < 0.15 ? 26 : 2.5;
      state.speed = Math.max(0, state.speed - braking * dt);
      state.bank *= 0.9;
      state.fuel = Math.min(state.fuelMax, state.fuel + 30 * dt);
      state.damage = Math.max(0, state.damage - 6 * dt);
      // 'landed' fires once per touchdown on a strip: a rolling plane that
      // briefly leaves the ground over a bump must not re-fire it, so the
      // strip is remembered across those flickers and only a new strip (or
      // a takeoff in between, which clears it) fires again.
      if (wasAirborne && state.landedStrip !== strip) {
        state.pitch = 0;
        state.landedStrip = strip;
        return 'landed';
      }
      state.landedStrip = strip;
      return '';
    }
    if (isWater(state.x, state.z)) {
      state.crashed = true;
      return 'ditched';
    }
    // Rough ground: damage scales with impact; a gentle touch just rolls.
    const impact = sinkRate + state.speed * 0.12;
    if (impact > 14) {
      state.damage += impact * loadout.armourMul;
      state.crashed = state.damage >= 100;
      return state.crashed ? 'crashed' : 'bump';
    }
    // Rolling on the ground: light rolling resistance, so a takeoff roll
    // can build speed (takeoff is checked at the top of this block).
    state.onGround = true;
    state.speed = Math.max(0, state.speed - 2.5 * dt);
    return '';
  }
  // Airborne: the strip memory stays (a bump that lifts the plane for one
  // step must not erase which strip it just landed on); only a real
  // takeoff clears it, in the takeoff check above.
  state.onGround = false;
  return '';
}

/** Write the flight state into the visible mesh (position + attitude). */
export function posePlaneMesh(mesh, state, time) {
  mesh.position.set(state.x, state.y, state.z);
  mesh.rotation.set(0, 0, 0);
  // The model faces -z; rotateY(heading - 90deg) maps -z onto the flight
  // direction (cos heading, 0, -sin heading). Pitch then roll, intrinsic.
  mesh.rotateY(state.heading - Math.PI / 2);
  mesh.rotateX(state.pitch);
  mesh.rotateZ(state.bank);
  const prop = mesh.userData.prop;
  if (prop) prop.rotation.z += (2 + state.throttle * 40) * 0.016;
  void time;
}
