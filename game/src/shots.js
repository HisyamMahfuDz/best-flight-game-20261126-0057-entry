// Deterministic screenshot scenes behind ?shot=title|play|approach|win.
// Each one plays the real rules forward from a fresh world at a fixed step,
// steered by the same autopilot a player could follow, so the frame is what
// a short game really looks like and the same seed always gives the same frame.
import { RING_COURSE, RUNWAY } from './config.js';

const STEP = 1 / 60;
const MAX_STEPS = 60 * 240; // at most 4 simulated minutes per scene

function settle(game, frames = 4) {
  for (let i = 0; i < frames; i += 1) game.frame(0.5);
  game.hud.update(game.state, game.mission, 0);
}

function flyCourse(game, stopWhen, targetSpeed = 62) {
  let steps = 0;
  while (steps < MAX_STEPS) {
    steps += 1;
    if (game.screen !== 'play') break;
    const target = game.missionTarget();
    if (!target) break;
    const dist = Math.hypot(target.x - game.state.x, target.y - game.state.y, target.z - game.state.z);
    const boost = dist < 160 && game.state.fuel > 30;
    const controls = game.autopilotTo(target, targetSpeed, boost);
    game.step(STEP, controls);
    if (stopWhen(game, dist)) break;
  }
  return steps;
}

function stageTitle(game) {
  game.showTitle();
  game.time = 12; // fixed orbit angle, so the title frame never changes
  settle(game);
  return { screen: 'title', best: 0 };
}

function stagePlay(game) {
  game.missionId = 'rings';
  game.loadoutId = 'swift';
  game.startMission();
  game.state.throttle = 0.7;
  flyCourse(game, (g) => g.mission.ringsDone >= 4, 62);
  // Keep flying toward ring 5 until it fills the frame, boosting for streaks.
  flyCourse(game, (g, dist) => dist < 260, 62);
  settle(game);
  return { screen: 'play', best: game.mission.score };
}

function stageApproach(game) {
  game.missionId = 'hop';
  game.loadoutId = 'tanker';
  game.startMission();
  // Place the plane on the final approach fix: 500 m west of the strip,
  // 45 m up, already configured for landing — the frame is what a real
  // final approach looks like, flown by the same autopilot as the player.
  game.state.x = RUNWAY.x - 500;
  game.state.y = RUNWAY.height + 45;
  game.state.z = RUNWAY.z;
  game.state.heading = 0; // east, along the runway
  game.state.speed = 46;
  game.state.throttle = 0.5;
  game.state.gearDown = true;
  game.state.onGround = false;
  // Fly the glide path: stop while still airborne, gear down, runway ahead.
  flyCourse(game, (g) => {
    const dx = g.state.x - RUNWAY.x;
    const dz = g.state.z - RUNWAY.z;
    const dist = Math.hypot(dx, dz);
    return dist < 300
      && g.state.y < RUNWAY.height + 60
      && g.state.y > RUNWAY.height + 20
      && g.state.verticalSpeed < 0
      && !g.state.onGround;
  }, 46);
  game.hud.flash('Final approach — gear down, on the glide path', 5);
  settle(game);
  return { screen: 'play', best: 0 };
}

function stageWin(game) {
  game.missionId = 'rings';
  game.loadoutId = 'swift';
  game.startMission();
  game.state.throttle = 0.7;
  flyCourse(game, (g) => g.mission.complete, 62);
  // A few frames so the win panel and the confetti of the moment settle.
  settle(game, 6);
  return { screen: game.screen, best: game.mission.score };
}

/**
 * Stage the named scene and expose the result for the screenshot driver.
 * Returns the debug snapshot of the staged frame.
 */
export function stageShot(name, game) {
  let staged;
  if (name === 'play') staged = stagePlay(game);
  else if (name === 'approach') staged = stageApproach(game);
  else if (name === 'win') staged = stageWin(game);
  else staged = stageTitle(game);
  const snapshot = game.debugSnapshot();
  snapshot.shot = name;
  snapshot.staged = staged;
  window.__shot = { ready: true, snapshot };
  return snapshot;
}
