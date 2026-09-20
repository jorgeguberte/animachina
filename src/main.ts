import * as THREE from "three";
import "./styles.css";

import type {
  ActorDefinition,
  Affordance,
  PerformanceEvent,
  Personality,
  PolicyDecision,
} from "./engine/model";
import { LocalPolicy } from "./engine/policy";
import { SceneRuntime } from "./engine/runtime";
import { plazaScene } from "./demo/plaza";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <div class="overlay">
    <div class="brand">
      <strong>Animachina</strong>
      <span>adaptive dark ride runtime · v0</span>
    </div>

    <div class="personality-picker">
      <button data-personality="glamorous" class="active">💎 Glamorous</button>
      <button data-personality="shy">🫣 Shy</button>
      <button data-personality="chaotic">😈 Chaotic</button>
    </div>

    <div class="debug">
      <div><b>Beat</b> <span data-debug="beat">arrival</span></div>
      <div><b>Decision</b> <span data-debug="decision">waiting…</span></div>
      <div><b>Performance</b> <span data-debug="performance">—</span></div>
    </div>

    <div class="legend">
      same scene · same actors · different performance<br />
      local policy today · Jev plugs into DecisionPolicy next
    </div>
  </div>
`;

const debugBeat = document.querySelector<HTMLElement>('[data-debug="beat"]')!;
const debugDecision = document.querySelector<HTMLElement>(
  '[data-debug="decision"]',
)!;
const debugPerformance = document.querySelector<HTMLElement>(
  '[data-debug="performance"]',
)!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17172d);
scene.fog = new THREE.Fog(0x17172d, 14, 28);

const aspect = innerWidth / innerHeight;
const frustumHeight = 12;
const camera = new THREE.OrthographicCamera(
  (-frustumHeight * aspect) / 2,
  (frustumHeight * aspect) / 2,
  frustumHeight / 2,
  -frustumHeight / 2,
  0.1,
  100,
);
camera.position.set(0, 18, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x31254c, 2.4));

const key = new THREE.DirectionalLight(0xffefd0, 2.2);
key.position.set(-5, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(5.15, 64),
  new THREE.MeshStandardMaterial({
    color: 0x626b83,
    roughness: 0.94,
  }),
);
plaza.rotation.x = -Math.PI / 2;
plaza.receiveShadow = true;
scene.add(plaza);

const path = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 1.35),
  new THREE.MeshStandardMaterial({
    color: 0x8f8193,
    roughness: 0.92,
  }),
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.015;
path.receiveShadow = true;
scene.add(path);

const actorObjects = new Map<string, THREE.Group>();
const actorPulse = new Map<string, number>();

function makeActor(actor: ActorDefinition) {
  const group = new THREE.Group();
  group.position.set(actor.position.x, 0.08, actor.position.z);

  if (actor.kind === "fountain") {
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0xa5c7d1, roughness: 0.62 }),
    );
    basin.castShadow = true;
    group.add(basin);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.06, 48),
      new THREE.MeshStandardMaterial({
        color: 0x80d8e7,
        emissive: 0x225a72,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      }),
    );
    water.position.y = 0.13;
    water.userData.animated = "water";
    group.add(water);
  }

  if (actor.kind === "statue") {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.58, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xb8adb3, roughness: 0.85 }),
    );
    group.add(base);

    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.9, 5),
      new THREE.MeshStandardMaterial({ color: 0xd0c8ca, roughness: 0.8 }),
    );
    body.position.y = 0.55;
    body.userData.animated = "statue";
    body.castShadow = true;
    group.add(body);
  }

  if (actor.kind === "flowers") {
    for (let i = 0; i < 9; i++) {
      const flower = new THREE.Mesh(
        new THREE.CircleGeometry(0.12 + (i % 3) * 0.025, 16),
        new THREE.MeshStandardMaterial({
          color: [0xff9fb8, 0xf6d67a, 0xd4a9ff][i % 3],
          emissive: 0x3a2035,
          emissiveIntensity: 0.3,
          side: THREE.DoubleSide,
        }),
      );
      const angle = (i / 9) * Math.PI * 2;
      const radius = 0.25 + (i % 4) * 0.12;
      flower.position.set(Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius);
      flower.rotation.x = -Math.PI / 2;
      flower.userData.animated = "flower";
      group.add(flower);
    }
  }

  if (actor.kind === "creature") {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0xf4c86c,
        roughness: 0.72,
      }),
    );
    body.scale.set(1.15, 0.65, 0.9);
    body.castShadow = true;
    body.userData.animated = "creature";
    group.add(body);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x211b2a }),
      );
      eye.position.set(side * 0.13, 0.10, -0.31);
      group.add(eye);
    }
  }

  actorObjects.set(actor.id, group);
  actorPulse.set(actor.id, 0);
  scene.add(group);
}

plazaScene.actors.forEach(makeActor);

const exitMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.52, 32),
  new THREE.MeshBasicMaterial({
    color: 0xb9a8ff,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  }),
);
exitMarker.rotation.x = -Math.PI / 2;
exitMarker.position.set(plazaScene.exit.x, 0.03, plazaScene.exit.z);
scene.add(exitMarker);

const vehicle = new THREE.Group();

const vehicleBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.32, 0.72, 6, 16),
  new THREE.MeshStandardMaterial({
    color: 0xf5d276,
    roughness: 0.58,
    emissive: 0x2e2208,
    emissiveIntensity: 0.32,
  }),
);
vehicleBody.rotation.x = Math.PI / 2;
vehicleBody.castShadow = true;
vehicle.add(vehicleBody);

const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.12, 0.32, 16),
  new THREE.MeshStandardMaterial({
    color: 0xfff0b0,
    emissive: 0x6a5418,
    emissiveIntensity: 0.45,
  }),
);
nose.rotation.x = Math.PI / 2;
nose.position.z = -0.55;
nose.position.y = 0.05;
vehicle.add(nose);

vehicle.position.y = 0.18;
scene.add(vehicle);

function triggerPerformance(event: PerformanceEvent) {
  if (!event.actor) {
    debugPerformance.textContent = "scene resolves → exit";
    return;
  }

  actorPulse.set(event.actor.id, 1);
  debugPerformance.textContent =
    `${event.actor.kind} performs · ${event.style}`;
}

const runtime = new SceneRuntime(plazaScene, new LocalPolicy(), {
  onDecision(decision: PolicyDecision, affordance: Affordance) {
    debugDecision.textContent =
      `${affordance.label} · ${decision.style} · ${decision.source}`;
  },
  onPerformance: triggerPerformance,
  onBeatChanged(beat) {
    debugBeat.textContent = beat.id;
  },
  onComplete() {
    debugPerformance.textContent = "scene complete ✓";
  },
});

let personality: Personality = "glamorous";
runtime.reset(personality);

document
  .querySelectorAll<HTMLButtonElement>("[data-personality]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      personality = button.dataset.personality as Personality;

      document
        .querySelectorAll<HTMLButtonElement>("[data-personality]")
        .forEach((item) => item.classList.toggle("active", item === button));

      debugDecision.textContent = "waiting…";
      debugPerformance.textContent = "—";
      runtime.reset(personality);
    });
  });

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);
  const t = performance.now() * 0.001;

  runtime.step(dt);

  const state = runtime.world.vehicle;
  vehicle.position.x = state.position.x;
  vehicle.position.z = state.position.z;
  vehicle.rotation.y = state.heading;

  const material = vehicleBody.material as THREE.MeshStandardMaterial;
  material.color.setHex(
    state.personality === "glamorous"
      ? 0xf4cc65
      : state.personality === "shy"
        ? 0x8fbed6
        : 0xe27e86,
  );

  for (const actor of plazaScene.actors) {
    const group = actorObjects.get(actor.id)!;
    const pulse = Math.max(0, (actorPulse.get(actor.id) ?? 0) - dt * 0.65);
    actorPulse.set(actor.id, pulse);

    const animated = group.children.filter((child) => child.userData.animated);

    for (const child of animated) {
      const kind = child.userData.animated;

      if (kind === "water") {
        child.scale.setScalar(1 + pulse * 0.42 + Math.sin(t * 3) * 0.025);
      }

      if (kind === "statue") {
        child.rotation.y = pulse * Math.sin(t * 4) * 0.9;
      }

      if (kind === "flower") {
        const s = 1 + pulse * 0.75;
        child.scale.setScalar(s);
      }

      if (kind === "creature") {
        child.position.y = pulse * Math.abs(Math.sin(t * 7)) * 0.55;
        child.rotation.y = pulse * Math.sin(t * 5) * 0.65;
      }
    }
  }

  exitMarker.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.10;
  exitMarker.rotation.z += dt * 0.18;

  renderer.render(scene, camera);
}

animate();

addEventListener("resize", () => {
  const nextAspect = innerWidth / innerHeight;
  camera.left = (-frustumHeight * nextAspect) / 2;
  camera.right = (frustumHeight * nextAspect) / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
