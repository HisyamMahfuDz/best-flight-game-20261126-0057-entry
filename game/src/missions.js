// Missions: three different sorties over the same archipelago — ring rally,
// island hop and storm courier — with progress, timers, scoring and the
// messages that tell the pilot what to do next. One job: the why of flying.
import { MISSIONS, RING_COURSE, STRIPS, RUNWAY } from './config.js';
import { heightAt } from './world.js';

/** Checkpoints for the Storm Courier mission: buoys over open water. */
export const COURIER_POINTS = [
  { x: 500, y: 70, z: 500 },
  { x: 1050, y: 80, z: -100 },
  { x: 300, y: 90, z: -900 },
  { x: -800, y: 80, z: -700 },
  { x: -1000, y: 70, z: 200 },
  { x: -300, y: 60, z: 700 },
];

export class MissionRunner {
  constructor(missionId = 'rings') {
    this.setMission(missionId);
  }

  setMission(missionId) {
    this.mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    this.ringIndex = 0;
    this.ringsDone = 0;
    this.stripsDone = [];
    this.checkpointIndex = 0;
    this.checkpointsDone = 0;
    this.score = 0;
    this.timeLeft = this.mission.parSeconds;
    this.complete = false;
    this.failed = false;
    this.objectiveText = this.mission.goal;
    this.events = [];
  }

  /** Distance from the plane to the current target, for the HUD arrow. */
  targetPosition() {
    if (this.mission.id === 'rings') return RING_COURSE[this.ringIndex] || null;
    if (this.mission.id === 'hop') {
      const all = [RUNWAY, ...STRIPS];
      return all[this.stripsDone.length] || null;
    }
    return COURIER_POINTS[this.checkpointIndex] || null;
  }

  targetName() {
    if (this.mission.id === 'rings') return `RING ${this.ringIndex + 1}/8`;
    if (this.mission.id === 'hop') {
      const names = ['Kestrel Isle', 'Turtle Cay', 'Palm Shoal'];
      return `LAND ${names[this.stripsDone.length] || '—'}`;
    }
    return `CHECKPOINT ${this.checkpointIndex + 1}/6`;
  }

  /**
   * Check progress against the plane's position. Returns event strings for
   * the game to announce: 'ring' | 'strip' | 'checkpoint' | 'complete' | ''.
   */
  update(state, dt, world) {
    if (this.complete || this.failed) return '';
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.failed = true;
      this.objectiveText = 'Out of time — the sortie is over.';
      return 'timeout';
    }
    if (this.mission.id === 'rings') return this.updateRings(state, world);
    if (this.mission.id === 'hop') return this.updateHop(state);
    return this.updateCourier(state);
  }

  updateRings(state, world) {
    const ring = world.rings[this.ringIndex];
    if (!ring) return '';
    const def = ring.userData.def;
    const dx = state.x - def.x;
    const dy = state.y - def.y;
    const dz = state.z - def.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 19) {
      ring.userData.passed = true;
      ring.material.color.setHex(0x37d67a);
      ring.material.emissive.setHex(0x0a5a2a);
      ring.userData.beacon.visible = false;
      this.ringsDone += 1;
      this.ringIndex += 1;
      const speedBonus = Math.round(Math.min(200, state.speed));
      const timeBonus = Math.round(Math.max(0, this.timeLeft));
      this.score += 500 + speedBonus;
      // A clean pass banks a little fuel: throttle discipline pays.
      state.fuel = Math.min(state.fuelMax, state.fuel + 4);
      this.objectiveText = this.ringIndex >= RING_COURSE.length
        ? 'Course complete — rally won!'
        : `Ring ${this.ringsDone}/8 — next: ${this.targetName()}`;
      if (this.ringIndex >= RING_COURSE.length) {
        this.complete = true;
        this.score += timeBonus * 5;
        return 'complete';
      }
      return 'ring';
    }
    return '';
  }

  updateHop(state) {
    if (!state.onGround || !state.landedStrip) return '';
    const strip = state.landedStrip;
    const key = `${strip.x},${strip.z}`;
    if (this.stripsDone.includes(key)) return '';
    this.stripsDone.push(key);
    this.score += 800;
    if (this.stripsDone.length >= 3) {
      this.complete = true;
      this.score += Math.round(this.timeLeft) * 5;
      this.objectiveText = 'All three strips — hop complete!';
      return 'complete';
    }
    const names = ['Turtle Cay', 'Palm Shoal'];
    this.objectiveText = `Landed ${this.stripsDone.length}/3 — next: ${names[this.stripsDone.length - 1] || 'home'}`;
    return 'strip';
  }

  updateCourier(state) {
    const point = COURIER_POINTS[this.checkpointIndex];
    if (!point) return '';
    const dx = state.x - point.x;
    const dy = state.y - point.y;
    const dz = state.z - point.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 26) {
      this.checkpointsDone += 1;
      this.checkpointIndex += 1;
      this.score += 600;
      this.timeLeft += 12; // each checkpoint buys a little more storm time
      if (this.checkpointIndex >= COURIER_POINTS.length) {
        this.complete = true;
        this.score += Math.round(this.timeLeft) * 5;
        this.objectiveText = 'Cargo delivered — courier run complete!';
        return 'complete';
      }
      this.objectiveText = `Checkpoint ${this.checkpointsDone}/6 — next: ${this.targetName()}`;
      return 'checkpoint';
    }
    return '';
  }

  /** Reset ring visuals when a mission restarts. */
  resetRings(world) {
    for (const ring of world.rings) {
      ring.userData.passed = false;
      ring.material.color.setHex(0xffb52e);
      ring.material.emissive.setHex(0x8a5a00);
      ring.userData.beacon.visible = true;
    }
  }

  /** Height of the ground under the plane, for the HUD radar altimeter. */
  groundClearance(state) {
    return Math.max(0, state.y - heightAt(state.x, state.z));
  }
}
