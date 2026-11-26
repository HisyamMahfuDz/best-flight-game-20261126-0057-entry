// The heads-up display: DOM overlay (crisp at any scale) showing airspeed,
// altitude, heading tape, throttle, fuel, damage, the mission banner and the
// attitude ball. One job: everything the pilot reads, updated every frame.
import { MISSIONS } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.els = {
      speed: $('hud-speed'),
      altitude: $('hud-alt'),
      heading: $('hud-heading'),
      compass: $('hud-compass'),
      throttle: $('hud-throttle-fill'),
      fuel: $('hud-fuel-fill'),
      fuelText: $('hud-fuel-text'),
      damage: $('hud-damage-fill'),
      damageText: $('hud-damage-text'),
      mission: $('hud-mission'),
      objective: $('hud-objective'),
      score: $('hud-score'),
      timer: $('hud-timer'),
      message: $('hud-message'),
      gear: $('hud-gear'),
      attitude: $('hud-attitude'),
      vspeed: $('hud-vspeed'),
    };
    this.attCtx = this.els.attitude.getContext('2d');
    this.messageTimer = 0;
  }

  setMission(missionId) {
    const mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    this.els.mission.textContent = mission.name.toUpperCase();
    this.els.objective.textContent = mission.goal;
  }

  /** Flash a centre-screen message for a few seconds. */
  flash(text, seconds = 2.5) {
    this.els.message.textContent = text;
    this.els.message.style.opacity = '1';
    this.messageTimer = seconds;
  }

  update(state, mission, dt) {
    const e = this.els;
    e.speed.textContent = `${state.knots}`;
    e.altitude.textContent = `${state.altitudeFt}`;
    e.heading.textContent = `${String(state.headingDeg).padStart(3, '0')}°`;
    e.vspeed.textContent = `${state.verticalSpeed >= 0 ? '+' : ''}${Math.round(state.verticalSpeed * 3.281 * 60)} fpm`;
    e.throttle.style.width = `${Math.round(state.throttle * 100)}%`;
    const fuelPct = Math.max(0, Math.round((state.fuel / state.fuelMax) * 100));
    e.fuel.style.width = `${fuelPct}%`;
    e.fuelText.textContent = `FUEL ${fuelPct}%`;
    e.fuel.style.background = fuelPct < 25 ? '#ff5040' : fuelPct < 50 ? '#ffb52e' : '#37d67a';
    e.damage.style.width = `${Math.round(state.damage)}%`;
    e.damageText.textContent = `DMG ${Math.round(state.damage)}%`;
    e.damage.style.background = state.damage > 60 ? '#ff5040' : '#ffb52e';
    e.gear.textContent = state.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    e.gear.style.color = state.gearDown ? '#37d67a' : '#ffb52e';
    if (mission) {
      e.score.textContent = `SCORE ${mission.score}`;
      const left = Math.max(0, Math.ceil(mission.timeLeft));
      e.timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      e.timer.style.color = left < 30 ? '#ff5040' : '#f2f6fa';
      e.objective.textContent = mission.objectiveText;
    }
    // Compass tape: headings every 30 degrees, centred on the current one.
    const tape = [];
    const current = state.headingDeg;
    for (let offset = -60; offset <= 60; offset += 15) {
      const deg = (current + offset + 360) % 360;
      const label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][Math.round(deg / 90) % 4] : `${deg}`;
      tape.push(`<span class="tick${offset === 0 ? ' centre' : ''}">${label}</span>`);
    }
    e.compass.innerHTML = tape.join('');
    this.drawAttitude(state);
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.els.message.style.opacity = '0';
    }
  }

  /** The attitude ball: horizon line tilts with bank, shifts with pitch. */
  drawAttitude(state) {
    const ctx = this.attCtx;
    const w = 96;
    const h = 96;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(state.bank);
    ctx.translate(0, state.pitch * 90);
    ctx.fillStyle = '#2f6fd0';
    ctx.fillRect(-60, -90, 120, 90);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-60, 0, 120, 90);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    ctx.restore();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 30, h / 2);
    ctx.lineTo(w / 2 - 8, h / 2);
    ctx.moveTo(w / 2 + 8, h / 2);
    ctx.lineTo(w / 2 + 30, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
