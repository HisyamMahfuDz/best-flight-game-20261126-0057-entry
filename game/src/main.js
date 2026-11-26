// Tradewind Rally — the game itself: screens, the frame loop, input wiring,
// mission flow, crashes and landings, and the debug hook the screenshot
// stager and the playtest read. One job: run the game.
import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS, LOADOUTS, RING_COURSE } from './config.js';
import { buildWorld, updateWorld } from './world.js';
import { buildPlaneMesh, FlightState, stepFlight, posePlaneMesh } from './plane.js';
import { ChaseCamera } from './camera.js';
import { Hud } from './hud.js';
import { MissionRunner, COURIER_POINTS } from './missions.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { createRenderer, createScene, fitRenderer } from './render.js';

const STEP = 1 / 60;

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = createRenderer(this.canvas);
    this.scene = createScene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
    this.chase = new ChaseCamera(this.camera);
    this.world = buildWorld(this.scene);
    this.planeMesh = buildPlaneMesh();
    this.scene.add(this.planeMesh);
    this.input = new Input();
    this.sounds = new SoundBank();
    this.hud = new Hud();
    this.state = new FlightState('swift');
    this.mission = new MissionRunner('rings');
    this.screen = 'title';
    this.missionId = 'rings';
    this.loadoutId = 'swift';
    this.bestScore = 0;
    this.time = 0;
    this.autopilot = null;
    this.endReason = '';
    this.endScore = 0;
    this.paused = false;
    this.shotName = new URLSearchParams(window.location.search).get('shot') || '';
    this.buildScreens();
    this.wireButtons();
    window.addEventListener('resize', () => fitRenderer(this.renderer, this.camera));
    window.__tradewind = this;
  }

  // ----- screens (DOM overlays) -----

  buildScreens() {
    const title = document.getElementById('screen-title');
    title.querySelector('.missions').innerHTML = MISSIONS.map((m, i) => `
      <button class="mission-card" data-mission="${m.id}">
        <span class="key">${i + 1}</span>
        <strong>${m.name}</strong>
        <span>${m.goal}</span>
        <em>Par ${Math.floor(m.parSeconds / 60)}:${String(m.parSeconds % 60).padStart(2, '0')}</em>
      </button>`).join('');
    title.querySelector('.loadouts').innerHTML = LOADOUTS.map((item) => `
      <button class="loadout-card" data-loadout="${item.id}">
        <strong>${item.name}</strong><span>${item.detail}</span>
      </button>`).join('');
    this.markSelected();
  }

  markSelected() {
    document.querySelectorAll('.mission-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.mission === this.missionId);
    });
    document.querySelectorAll('.loadout-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.loadout === this.loadoutId);
    });
  }

  wireButtons() {
    document.querySelectorAll('.mission-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.sounds.ensure();
        this.sounds.click();
        this.missionId = card.dataset.mission;
        this.markSelected();
      });
    });
    document.querySelectorAll('.loadout-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.sounds.ensure();
        this.sounds.click();
        this.loadoutId = card.dataset.loadout;
        this.markSelected();
      });
    });
    document.getElementById('btn-start').addEventListener('click', () => this.startMission());
    document.getElementById('btn-restart').addEventListener('click', () => this.startMission());
    document.getElementById('btn-title').addEventListener('click', () => this.showTitle());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause(false));
  }

  showTitle() {
    this.screen = 'title';
    this.state = new FlightState(this.loadoutId);
    this.mission = new MissionRunner(this.missionId);
    this.mission.resetRings(this.world);
    document.getElementById('screen-title').classList.remove('hidden');
    document.getElementById('screen-end').classList.add('hidden');
    document.getElementById('screen-pause').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
  }

  startMission() {
    this.sounds.ensure();
    this.state = new FlightState(this.loadoutId);
    this.mission = new MissionRunner(this.missionId);
    this.mission.resetRings(this.world);
    this.hud.setMission(this.missionId);
    this.screen = 'play';
    this.endReason = '';
    document.getElementById('screen-title').classList.add('hidden');
    document.getElementById('screen-end').classList.add('hidden');
    document.getElementById('screen-pause').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.hud.flash(`${this.mission.mission.name} — ${this.mission.mission.goal}`, 4);
  }

  showEnd(won, reason) {
    this.screen = won ? 'win' : 'lose';
    this.endReason = reason;
    this.endScore = this.mission.score;
    this.bestScore = Math.max(this.bestScore, this.endScore);
    const end = document.getElementById('screen-end');
    end.querySelector('.end-title').textContent = won ? 'MISSION COMPLETE' : 'SORTIE OVER';
    end.querySelector('.end-reason').textContent = reason;
    end.querySelector('.end-score').textContent = `SCORE ${this.endScore}`;
    end.querySelector('.end-best').textContent = `BEST ${this.bestScore} · ${this.mission.mission.name}`;
    end.querySelector('.end-detail').textContent = won
      ? `Rings ${this.mission.ringsDone}/8 · Strips ${this.mission.stripsDone.length}/3 · Checkpoints ${this.mission.checkpointsDone}/6 · Time left ${Math.max(0, Math.ceil(this.mission.timeLeft))}s`
      : 'Press R to fly again, or return to the hangar to pick another sortie.';
    end.classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  }

  togglePause(on) {
    this.paused = on;
    document.getElementById('screen-pause').classList.toggle('hidden', !on);
  }

  // ----- autopilot (drives the screenshot stager and the demo) -----

  /** Steer toward a point: returns {steer, pitchIn, throttleIn, boost}. */
  autopilotTo(target, targetSpeed = 62, boost = false) {
    const s = this.state;
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const dz = target.z - s.z;
    const distH = Math.hypot(dx, dz);
    const desiredHeading = Math.atan2(-dz, dx);
    const headingError = wrapAngle(desiredHeading - s.heading);
    // Positive bank is a right bank, and a right bank decreases heading,
    // so steer against the sign of the heading error.
    const steer = Math.max(-1, Math.min(1, -headingError * 1.8));
    const desiredPitch = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, Math.max(30, distH))));
    const pitchIn = Math.max(-1, Math.min(1, (desiredPitch - s.pitch) * 6));
    let throttleIn = 0;
    if (s.speed < targetSpeed - 3) throttleIn = 1;
    else if (s.speed > targetSpeed + 3) throttleIn = -1;
    return { steer, pitchIn, throttleIn, boost };
  }

  /** Autopilot target for the current mission: next ring / strip / checkpoint. */
  missionTarget() {
    const target = this.mission.targetPosition();
    if (!target) return null;
    if (this.mission.mission.id === 'hop' && target.z !== undefined && 'headingDeg' in target) {
      // Aim at the strip's final approach point, 430 m out, then the strip.
      const heading = (target.headingDeg * Math.PI) / 180;
      const dist = Math.hypot(this.state.x - target.x, this.state.z - target.z);
      if (dist > 430) {
        return {
          x: target.x - Math.sin(heading) * 430,
          y: target.height + 50,
          z: target.z + Math.cos(heading) * 430,
        };
      }
      // On final: aim at the touchdown zone, 50 m past the strip centre
      // at strip height, so the descent meets the ground on the strip
      // itself. (Aiming past the strip made the plane touch down beyond
      // its far end; aiming at the centre made it turn back on itself.)
      const axisX = Math.sin(heading);
      const axisZ = -Math.cos(heading);
      const forwardX = Math.cos(this.state.heading);
      const forwardZ = -Math.sin(this.state.heading);
      const sign = forwardX * axisX + forwardZ * axisZ < 0 ? -1 : 1;
      return {
        x: target.x + sign * axisX * 50,
        y: target.height,
        z: target.z + sign * axisZ * 50,
      };
    }
    return { x: target.x, y: target.y, z: target.z };
  }

  // ----- one fixed step -----

  /** Advance the simulation one fixed step with the given stick inputs. */
  step(dt, controls) {
    if (this.screen !== 'play' || this.paused) return '';
    const event = stepFlight(
      this.state, dt, controls.steer, controls.pitchIn, controls.throttleIn, controls.boost,
    );
    const missionEvent = this.mission.update(this.state, dt, this.world);
    if (event === 'landed') {
      this.sounds.thud(false);
      if (missionEvent === 'complete') this.finish(true, 'All objectives complete — beautiful flying.');
      else if (missionEvent === 'strip') this.hud.flash('Strip landed — refuelled and patched up!');
      else this.hud.flash('Touchdown — fuel topped up.');
    } else if (event === 'crashed') {
      this.sounds.thud(true);
      this.burst(this.state.x, this.state.y, this.state.z, 40, 0xff5040);
      this.finish(false, 'The airframe came apart on the terrain.');
    } else if (event === 'ditched') {
      this.sounds.thud(true);
      this.burst(this.state.x, 2, this.state.z, 40, 0x9fd8ef);
      this.finish(false, 'Ditched in the sea — the Kestrel floats, but the sortie is over.');
    } else if (event === 'bump') {
      this.sounds.thud(false);
      this.hud.flash('Rough ground — check the damage gauge!');
    } else if (event === 'fuel-out') {
      this.hud.flash('Fuel empty — gliding! Find a strip, fast.');
    }
    if (missionEvent === 'ring') {
      this.sounds.chime();
      this.hud.flash(`Ring ${this.mission.ringsDone}/8 — nice flying!`);
    } else if (missionEvent === 'checkpoint') {
      this.sounds.chime();
      this.hud.flash(`Checkpoint ${this.mission.checkpointsDone}/6 — +12s on the clock!`);
    } else if (missionEvent === 'complete') {
      this.sounds.chime();
      this.finish(true, 'All objectives complete — beautiful flying.');
    } else if (missionEvent === 'timeout') {
      this.finish(false, 'The clock ran out before the sortie was done.');
    }
    if (this.state.boosting) this.streak();
    this.sounds.setFlight(this.state.throttle, this.state.speed, this.state.boosting);
    return missionEvent || event;
  }

  /** White speed streaks trailing the plane while boosting. */
  streak() {
    const s = this.state;
    const backX = -Math.cos(s.heading);
    const backZ = Math.sin(s.heading);
    for (let i = 0; i < 3; i += 1) {
      this.world.particles.spawn(
        s.x + backX * 8 + (Math.random() - 0.5) * 6,
        s.y + (Math.random() - 0.5) * 4,
        s.z + backZ * 8 + (Math.random() - 0.5) * 6,
        backX * 30, 0, backZ * 30,
      );
    }
  }

  /** A burst of particles at a point (crash, splash). */
  burst(x, y, z, count, colour) {
    void colour;
    for (let i = 0; i < count; i += 1) {
      this.world.particles.spawn(
        x, y, z,
        (Math.random() - 0.5) * 40,
        Math.random() * 25,
        (Math.random() - 0.5) * 40,
      );
    }
  }

  finish(won, reason) {
    if (this.screen !== 'play') return;
    this.showEnd(won, reason);
  }

  // ----- frame -----

  frame(dt) {
    this.time += dt;
    if (this.screen === 'title') {
      this.chase.orbit(this.state, this.time);
    } else if (this.screen === 'play' || this.screen === 'win' || this.screen === 'lose') {
      this.chase.update(this.state, dt);
    }
    updateWorld(this.world, dt, this.time);
    posePlaneMesh(this.planeMesh, this.state, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  /** Read live input into stick controls. */
  liveControls() {
    const input = this.input;
    let throttleIn = 0;
    if (input.isHeld('throttleUp')) throttleIn += 1;
    if (input.isHeld('throttleDown')) throttleIn -= 1;
    let steer = 0;
    if (input.isHeld('bankLeft')) steer -= 1;
    if (input.isHeld('bankRight')) steer += 1;
    // Pitch: arrow keys hold a climb or a dive; a mouse drag overrides while held.
    let pitchIn = 0;
    if (input.isHeld('pitchUp')) pitchIn += 1;
    if (input.isHeld('pitchDown')) pitchIn -= 1;
    if (this.mousePitch !== undefined && this.mousePitch !== 0) pitchIn = this.mousePitch;
    return {
      steer,
      pitchIn,
      throttleIn,
      boost: input.isHeld('boost'),
    };
  }

  handleOneShots() {
    const input = this.input;
    if (input.wasPressed('gear')) {
      this.state.gearDown = !this.state.gearDown;
      this.hud.flash(this.state.gearDown ? 'Gear down' : 'Gear up');
    }
    if (input.wasPressed('restart') && this.screen !== 'title') this.startMission();
    if (input.wasPressed('pause') && this.screen === 'play') this.togglePause(!this.paused);
    if (input.wasPressed('mute')) {
      this.sounds.setMuted(!this.sounds.muted);
      this.hud.flash(this.sounds.muted ? 'Sound off' : 'Sound on');
    }
    if (this.screen === 'title') {
      if (input.wasPressed('mission1')) { this.missionId = 'rings'; this.markSelected(); }
      if (input.wasPressed('mission2')) { this.missionId = 'hop'; this.markSelected(); }
      if (input.wasPressed('mission3')) { this.missionId = 'courier'; this.markSelected(); }
      if (input.wasPressed('confirm')) this.startMission();
    } else if ((this.screen === 'win' || this.screen === 'lose') && input.wasPressed('confirm')) {
      this.startMission();
    }
  }

  /** Mouse drag steers pitch: drag up to climb, down to dive. */
  wireMouse() {
    let dragging = false;
    let lastY = 0;
    this.canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastY = event.clientY;
      this.sounds.ensure();
    });
    window.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dy = lastY - event.clientY;
      lastY = event.clientY;
      this.mousePitch = Math.max(-1, Math.min(1, dy * 0.02));
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
      this.mousePitch = 0;
    });
  }

  run() {
    this.wireMouse();
    this.showTitle();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.handleOneShots();
      if (this.screen === 'play' && !this.paused) {
        let controls = this.liveControls();
        if (this.autopilot) controls = this.autopilot();
        // Fixed-step the sim so physics is frame-rate independent.
        let remaining = dt;
        while (remaining > 0) {
          const h = Math.min(STEP, remaining);
          this.step(h, controls);
          remaining -= h;
        }
        this.hud.update(this.state, this.mission, dt);
      }
      this.frame(dt);
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ----- debug / screenshot support -----

  /** Count visible scene objects for the density assertion. */
  visibleCounts() {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    frustum.setFromProjectionMatrix(matrix);
    const inView = (pos) => frustum.containsPoint(pos);
    const counts = { rings: 0, clouds: 0, boats: 0, birds: 0, beacons: 0, particles: 0 };
    for (const ring of this.world.rings) {
      if (inView(ring.position)) counts.rings += 1;
      if (ring.userData.beacon.visible && inView(ring.userData.beacon.position)) counts.beacons += 1;
    }
    for (const cloud of this.world.clouds) if (inView(cloud.position)) counts.clouds += 1;
    for (const boat of this.world.boats) if (inView(boat.position)) counts.boats += 1;
    for (const bird of this.world.birds) if (inView(bird.position)) counts.birds += 1;
    for (const p of this.world.particles.pool) if (p.life > 0) counts.particles += 1;
    counts.total = counts.rings + counts.clouds + counts.boats + counts.birds + counts.beacons;
    return counts;
  }

  debugSnapshot() {
    return {
      screen: this.screen,
      mission: this.mission.mission.id,
      ringsDone: this.mission.ringsDone,
      score: this.mission.score,
      speed: Math.round(this.state.speed),
      knots: this.state.knots,
      altitudeFt: this.state.altitudeFt,
      headingDeg: this.state.headingDeg,
      fuel: Math.round(this.state.fuel),
      damage: Math.round(this.state.damage),
      onGround: this.state.onGround,
      crashed: this.state.crashed,
      counts: this.visibleCounts(),
    };
  }
}
