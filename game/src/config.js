// Tradewind Rally — shared tuning constants, mission definitions and loadouts.
// One job: every number the rest of the game reads, in one place.
export const WORLD = {
  seaLevel: 0,
  /** Half-size of the playable sea, in metres. */
  extent: 1500,
  /** Terrain mesh resolution (segments per side). */
  terrainSegments: 110,
  /** Terrain mesh half-size; the mesh is a little larger than the playable area. */
  terrainSize: 3400,
  /** Fog: the sea haze that keeps far islands soft. */
  fogNear: 700,
  fogFar: 2600,
};

export const PLANE = {
  /** Top speed at full throttle, m/s. */
  maxSpeed: 92,
  /** Below this the wing stops flying and the nose drops. */
  stallSpeed: 26,
  /** How fast throttle moves, per second. */
  throttleRate: 0.55,
  /** Max bank angle, radians. */
  maxBank: 1.05,
  /** Max pitch angle, radians. */
  maxPitch: 0.42,
  /** Turn rate at full bank, radians per second. */
  turnRate: 0.55,
  /** Pitch authority, radians per second. */
  pitchRate: 0.5,
  /** Fuel burn at full throttle, percent per second. */
  fuelBurn: 0.32,
  /** Extra fuel burn while boosting, percent per second. */
  boostBurn: 1.1,
  /** Boost speed multiplier. */
  boostFactor: 1.35,
  /** Starting fuel, percent. */
  fuelStart: 100,
  /** Damage taken per hard impact. */
  crashDamage: 100,
};

export const RUNWAY = {
  /** Main runway centre, on the big island. */
  x: 0,
  z: -140,
  /** Runway heading, degrees (east = 90). The strip runs east-west. */
  headingDeg: 90,
  length: 300,
  width: 26,
  /** Terrain height of the flattened strip. */
  height: 7,
};

export const ISLANDS = [
  // name, x, z, radius, peak height, tint
  { name: 'Kestrel Isle', x: 0, z: 0, r: 620, peak: 96, tint: 0x4d8a4a },
  { name: 'Turtle Cay', x: 760, z: 520, r: 270, peak: 42, tint: 0x5a9a52 },
  { name: 'Palm Shoal', x: -680, z: 430, r: 300, peak: 54, tint: 0x4d8a4a },
  { name: 'Coral Head', x: 470, z: -680, r: 230, peak: 36, tint: 0x6aa854 },
  { name: 'Storm Bluff', x: -520, z: -620, r: 290, peak: 62, tint: 0x557a48 },
  { name: 'Far Beacon', x: 1150, z: -220, r: 185, peak: 30, tint: 0x5a9a52 },
  { name: 'West Reef', x: -1150, z: -120, r: 205, peak: 34, tint: 0x6aa854 },
];

export const RING_COURSE = [
  { x: 0, y: 62, z: 380 },
  { x: 330, y: 74, z: 120 },
  { x: 700, y: 66, z: -160 },
  { x: 470, y: 80, z: -640 },
  { x: 0, y: 86, z: -520 },
  { x: -470, y: 74, z: -620 },
  { x: -720, y: 64, z: -180 },
  { x: -360, y: 58, z: 180 },
];

export const STRIPS = [
  // Secondary landing strips for the Island Hop mission.
  { name: 'Turtle Cay strip', x: 760, z: 520, headingDeg: 45, length: 180, width: 20, height: 6 },
  { name: 'Palm Shoal strip', x: -680, z: 430, headingDeg: 135, length: 180, width: 20, height: 6 },
];

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Rally',
    short: 'RINGS',
    goal: 'Fly through all 8 golden rings in order',
    detail: 'Throttle discipline wins: rings sit low over the sea and high over the bluffs. A clean pass banks you bonus fuel.',
    parSeconds: 150,
  },
  {
    id: 'hop',
    name: 'Island Hop',
    short: 'HOP',
    goal: 'Land on all 3 airstrips, then return home',
    detail: 'Gear down (G), slow to under 110 knots and kiss the strip. Every landing refuels and patches the airframe.',
    parSeconds: 240,
  },
  {
    id: 'courier',
    name: 'Storm Courier',
    short: 'COURIER',
    goal: 'Hit 6 checkpoints before the storm timer runs out',
    detail: 'A timed dash through gusts. Boost (Space) burns fuel fast — spend it on the long legs only.',
    parSeconds: 120,
  },
];

export const LOADOUTS = [
  {
    id: 'swift',
    name: 'Swift Wing',
    detail: '+15% top speed, −20% fuel tank',
    speedMul: 1.15,
    fuelMul: 0.8,
    armourMul: 1,
  },
  {
    id: 'tanker',
    name: 'Long Tank',
    detail: '+40% fuel, −10% top speed',
    speedMul: 0.9,
    fuelMul: 1.4,
    armourMul: 1,
  },
  {
    id: 'sturdy',
    name: 'Sturdy Frame',
    detail: 'Half damage from rough landings',
    speedMul: 1,
    fuelMul: 1,
    armourMul: 0.5,
  },
];

export const COLOURS = {
  skyTop: 0x2f6fd0,
  skyBottom: 0xbfe3f2,
  sea: 0x1d7f9e,
  seaDeep: 0x0d5a78,
  sand: 0xe8d29a,
  grass: 0x4d8a4a,
  rock: 0x8a7f72,
  snow: 0xf2f4f6,
  ringGold: 0xffb52e,
  ringDone: 0x37d67a,
  runway: 0x3a3f46,
};
