// The archipelago: analytic terrain height shared by the mesh and the flight
// model, plus every visible object in the sky and on the sea (runway, rings,
// clouds, boats, birds, palms, tower, lighthouse). One job: the world itself.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, ISLANDS, RUNWAY, STRIPS, RING_COURSE, COLOURS } from './config.js';
import { mulberry32, pick, range } from './rng.js';

/** Gaussian bump of one island, before any flattening. */
function islandHeight(x, z, island) {
  const dx = (x - island.x) / island.r;
  const dz = (z - island.z) / island.r;
  const d2 = dx * dx + dz * dz;
  if (d2 > 4) return 0;
  // A soft dome with a slightly flattened top and a beach shelf near the water.
  const dome = Math.exp(-d2 * 1.6);
  const shelf = Math.exp(-d2 * 6) * 0.4;
  return island.peak * dome + 3 * shelf - 2.5;
}

/** Blend factor 0..1 inside a landing strip's flattened rectangle. */
function stripBlend(x, z, strip) {
  // Strip axis in world (x, z) for a heading of `d` degrees (0 = north, 90 = east):
  // axis = (sin d, -cos d), perpendicular = (cos d, sin d).
  const heading = (strip.headingDeg * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  const along = dx * Math.sin(heading) - dz * Math.cos(heading);
  const across = dx * Math.cos(heading) + dz * Math.sin(heading);
  const halfL = strip.length / 2 + 40;
  const halfW = strip.width / 2 + 40;
  if (Math.abs(along) > halfL || Math.abs(across) > halfW) return 0;
  const edge = Math.min(
    (halfL - Math.abs(along)) / 40,
    (halfW - Math.abs(across)) / 40,
    1,
  );
  return edge * edge * (3 - 2 * edge);
}

/** Ground height at any (x, z): islands, sea floor, flattened strips. */
export function heightAt(x, z) {
  let h = -4;
  for (const island of ISLANDS) h += islandHeight(x, z, island);
  // The airfield plateau: a wide flattened shelf around the main runway so
  // the strip and its approach sit on level ground, not on the island's flank.
  const airfield = stripBlend(x, z, {
    x: RUNWAY.x,
    z: RUNWAY.z,
    headingDeg: RUNWAY.headingDeg,
    length: 900,
    width: 440,
  });
  if (airfield > 0) h = h * (1 - airfield) + RUNWAY.height * airfield;
  const main = stripBlend(x, z, RUNWAY);
  if (main > 0) h = h * (1 - main) + RUNWAY.height * main;
  for (const strip of STRIPS) {
    const blend = stripBlend(x, z, strip);
    if (blend > 0) h = h * (1 - blend) + strip.height * blend;
  }
  return h;
}

export function isWater(x, z) {
  return heightAt(x, z) < 0.4;
}

/** Colour of terrain by height: sand, grass, rock, snow. */
function terrainColour(h, out) {
  if (h < 1.5) out.setHex(COLOURS.sand);
  else if (h < 22) out.setHex(COLOURS.grass);
  else if (h < 70) out.setHex(COLOURS.rock);
  else out.setHex(COLOURS.snow);
  // Slight variation so the mesh does not read as flat colour.
  const shade = 0.92 + ((h * 37) % 10) / 100;
  out.multiplyScalar(shade);
  return out;
}

/** Build the coloured heightfield mesh for the whole archipelago. */
function buildTerrain(scene) {
  const size = WORLD.terrainSize;
  const seg = WORLD.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    terrainColour(h, colour);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

/** The sea: one big translucent plane so shallows read as turquoise. */
function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.terrainSize * 1.6, WORLD.terrainSize * 1.6);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({
      color: COLOURS.sea,
      transparent: true,
      opacity: 0.82,
      shininess: 120,
      specular: 0x99ccff,
    }),
  );
  mesh.position.y = 0.15;
  mesh.name = 'sea';
  scene.add(mesh);
  return mesh;
}

/** Procedural runway texture: asphalt, centre line, thresholds, numbers. */
function runwayTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#e8e8e8';
  for (let x = 24; x < 488; x += 48) ctx.fillRect(x, 44, 26, 8);
  ctx.fillRect(8, 8, 496, 4);
  ctx.fillRect(8, 84, 496, 4);
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 40, 66);
  ctx.fillText(label, 472, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/** A landing strip mesh (runway + edge lights) at the given strip definition. */
function buildStrip(scene, strip, label) {
  const group = new THREE.Group();
  const tex = runwayTexture(label);
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.length, strip.width),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  surface.rotation.x = -Math.PI / 2;
  // Rotate the flattened plane so its length runs along the strip heading.
  surface.rotation.z = Math.PI / 2 - (strip.headingDeg * Math.PI) / 180;
  surface.position.set(strip.x, strip.height + 0.25, strip.z);
  group.add(surface);
  // Edge lights: small amber spheres along both sides.
  const lightGeo = new THREE.SphereGeometry(0.9, 6, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  const count = Math.floor(strip.length / 30);
  const heading = (strip.headingDeg * Math.PI) / 180;
  const axisX = Math.sin(heading);
  const axisZ = -Math.cos(heading);
  const perpX = Math.cos(heading);
  const perpZ = Math.sin(heading);
  for (let i = 0; i <= count; i += 1) {
    const along = -strip.length / 2 + (i * strip.length) / count;
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(
        strip.x + axisX * along + perpX * side * (strip.width / 2 + 2),
        strip.height + 0.6,
        strip.z + axisZ * along + perpZ * side * (strip.width / 2 + 2),
      );
      group.add(light);
    }
  }
  scene.add(group);
  return group;
}

/** Golden torus rings of the rally course; index order is the course order. */
function buildRings(scene) {
  const rings = [];
  const geo = new THREE.TorusGeometry(18, 1.4, 12, 42);
  for (let i = 0; i < RING_COURSE.length; i += 1) {
    const def = RING_COURSE[i];
    const mat = new THREE.MeshStandardMaterial({
      color: COLOURS.ringGold,
      emissive: 0x8a5a00,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.35,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(def.x, def.y, def.z);
    // Face the ring toward the previous course point (or the start line).
    const prev = RING_COURSE[(i + RING_COURSE.length - 1) % RING_COURSE.length];
    ring.lookAt(prev.x, prev.y, prev.z);
    ring.userData = { index: i, def, passed: false, baseEmissive: 0.7 };
    scene.add(ring);
    rings.push(ring);
    // Number beacon: a small floating marker above the ring.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    beacon.position.set(def.x, def.y + 24, def.z);
    scene.add(beacon);
    ring.userData.beacon = beacon;
  }
  return rings;
}

/** Drifting cloud puffs, each a cluster of white spheres. */
function buildClouds(scene, rng) {
  const clouds = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 26; i += 1) {
    const group = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 4);
    for (let p = 0; p < puffs; p += 1) {
      const r = range(rng, 14, 30);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set(range(rng, -50, 50), range(rng, -6, 8), range(rng, -22, 22));
      puff.scale.y = 0.45;
      group.add(puff);
    }
    group.position.set(range(rng, -1500, 1500), range(rng, 170, 320), range(rng, -1500, 1500));
    group.userData.speed = range(rng, 1.5, 4);
    scene.add(group);
    clouds.push(group);
  }
  return clouds;
}

/** Small sailing boats cruising slow circles on the sea. */
function buildBoats(scene, rng) {
  const boats = [];
  for (let i = 0; i < 8; i += 1) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xd84a3a, 0x2e6fd8, 0xe8e8e8, 0x3a9a5a]) }),
    );
    hull.position.y = 1;
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 12, 6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
    );
    mast.position.y = 7;
    group.add(mast);
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 9, 4),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    sail.position.set(0, 8, 0);
    sail.scale.z = 0.25;
    group.add(sail);
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 250, 1100);
    group.userData = { angle, radius, speed: range(rng, 0.008, 0.02), bob: rng() * 6 };
    scene.add(group);
    boats.push(group);
  }
  return boats;
}

/** Flocks of birds: two flapping wings each, circling the islands. */
function buildBirds(scene, rng) {
  const birds = [];
  const wingGeo = new THREE.PlaneGeometry(5, 1.6);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i += 1) {
    const group = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, wingMat);
    left.position.x = -2.4;
    const right = new THREE.Mesh(wingGeo, wingMat);
    right.position.x = 2.4;
    group.add(left);
    group.add(right);
    group.userData = {
      left,
      right,
      angle: rng() * Math.PI * 2,
      radius: range(rng, 120, 420),
      height: range(rng, 60, 140),
      speed: range(rng, 0.05, 0.12),
      phase: rng() * 6,
      centre: pick(rng, ISLANDS),
    };
    scene.add(group);
    birds.push(group);
  }
  return birds;
}

/** Palm trees on the beaches, as instanced trunks and canopies. */
function buildPalms(scene, rng) {
  const spots = [];
  let tries = 0;
  while (spots.length < 130 && tries < 3000) {
    tries += 1;
    const x = range(rng, -1300, 1300);
    const z = range(rng, -1300, 1300);
    const h = heightAt(x, z);
    if (h > 1 && h < 9) spots.push([x, h, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 9, 6);
  trunkGeo.translate(0, 4.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopyGeo = new THREE.ConeGeometry(4.2, 6, 7);
  canopyGeo.translate(0, 10.5, 0);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  spots.forEach(([x, h, z], i) => {
    euler.set(range(rng, -0.08, 0.08), rng() * Math.PI * 2, range(rng, -0.08, 0.08));
    quat.setFromEuler(euler);
    const s = range(rng, 0.8, 1.4);
    scale.set(s, s, s);
    matrix.compose(new THREE.Vector3(x, h, z), quat, scale);
    trunks.setMatrixAt(i, matrix);
    canopies.setMatrixAt(i, matrix);
  });
  scene.add(trunks);
  scene.add(canopies);
  return { trunks, canopies };
}

/** Control tower + hangar beside the main runway; lighthouse on Far Beacon. */
function buildLandmarks(scene) {
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(10, 42, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  shaft.position.y = 21;
  tower.add(shaft);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(16, 8, 16),
    new THREE.MeshPhongMaterial({ color: 0x2e6fd8, shininess: 80 }),
  );
  cab.position.y = 46;
  tower.add(cab);
  tower.position.set(60, RUNWAY.height, -200);
  scene.add(tower);
  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, 30, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xc8682e }),
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(-90, RUNWAY.height, -210);
  scene.add(hangar);
  const light = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 34, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  column.position.y = 17;
  light.add(column);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 36;
  light.add(lamp);
  light.position.set(1150, heightAt(1150, -220), -220);
  scene.add(light);
  return { tower, hangar, lighthouse: light };
}

/** Speed streaks behind the plane while boosting, and impact bursts. */
function buildParticles(scene) {
  const max = 240;
  const positions = new Float32Array(max * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, transparent: true, opacity: 0.85 }),
  );
  points.frustumCulled = false;
  scene.add(points);
  const pool = [];
  for (let i = 0; i < max; i += 1) pool.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  return {
    points,
    pool,
    spawn(x, y, z, vx, vy, vz) {
      const p = pool.find((item) => item.life <= 0);
      if (!p) return;
      p.life = 0.9;
      p.x = x; p.y = y; p.z = z;
      p.vx = vx; p.vy = vy; p.vz = vz;
    },
    update(dt) {
      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 6 * dt;
        }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Build the whole world and return its animated parts. */
export function buildWorld(scene, seed = 20261126) {
  const rng = mulberry32(seed);
  buildTerrain(scene);
  buildSea(scene);
  buildStrip(scene, RUNWAY, '09');
  for (const strip of STRIPS) {
    const label = strip.name.startsWith('Turtle') ? '27' : '18';
    buildStrip(scene, strip, label);
  }
  const rings = buildRings(scene);
  const clouds = buildClouds(scene, rng);
  const boats = buildBoats(scene, rng);
  const birds = buildBirds(scene, rng);
  const palms = buildPalms(scene, rng);
  const landmarks = buildLandmarks(scene);
  const particles = buildParticles(scene);
  return { rings, clouds, boats, birds, palms, landmarks, particles };
}

/** Animate clouds, boats, birds and ring pulses; call once per frame. */
export function updateWorld(world, dt, time) {
  for (const cloud of world.clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 1600) cloud.position.x = -1600;
  }
  for (const boat of world.boats) {
    const u = boat.userData;
    u.angle += u.speed * dt;
    boat.position.set(Math.cos(u.angle) * u.radius, 0.4 + Math.sin(time * 0.8 + u.bob) * 0.5, Math.sin(u.angle) * u.radius);
    boat.rotation.y = -u.angle;
  }
  for (const bird of world.birds) {
    const u = bird.userData;
    u.angle += u.speed * dt;
    const cx = u.centre.x;
    const cz = u.centre.z;
    bird.position.set(cx + Math.cos(u.angle) * u.radius, u.height + Math.sin(time + u.phase) * 4, cz + Math.sin(u.angle) * u.radius);
    bird.rotation.y = -u.angle;
    const flap = Math.sin(time * 9 + u.phase) * 0.7;
    u.left.rotation.z = flap;
    u.right.rotation.z = -flap;
  }
  for (const ring of world.rings) {
    const u = ring.userData;
    if (!u.passed) {
      const pulse = 1 + Math.sin(time * 3 + u.index) * 0.08;
      ring.scale.setScalar(pulse);
      u.beacon.position.y = u.def.y + 24 + Math.sin(time * 2 + u.index) * 2;
    }
  }
  world.particles.update(dt);
}
