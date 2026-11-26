// The three.js stage: renderer, gradient sky, sun, lights and fog, and the
// one call that draws a frame. One job: the picture, not the rules.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, COLOURS } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  return renderer;
}

/** Sky dome: a big sphere with a painted vertical gradient, no file needed. */
function buildSky(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#1d5fa8');
  gradient.addColorStop(0.45, '#4f97d8');
  gradient.addColorStop(0.72, '#a8d4ea');
  gradient.addColorStop(1, '#e8f2f6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  sky.name = 'sky';
  scene.add(sky);
  return sky;
}

/** Sun disc + lens glow, placed low over the western sea. */
function buildSun(scene) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, fog: false }),
  );
  group.add(disc);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(190, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.z = -2;
  group.add(glow);
  group.position.set(-2600, 620, -1800);
  group.lookAt(0, 0, 0);
  scene.add(group);
  return group;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe4ef, WORLD.fogNear, WORLD.fogFar);
  buildSky(scene);
  buildSun(scene);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(-1200, 900, -600);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(COLOURS.skyTop, 0x3a6a4a, 0.9);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);
  return scene;
}

/** Resize the renderer and camera when the window changes. */
export function fitRenderer(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
