import * as THREE from "three";
import "./styles.css";

import type {
  ActorDefinition,
  ActorPerformanceEvent,
  PersonalityProfile,
  VehicleDecision,
  VehicleOpportunity,
} from "./engine/model";
import { LocalPolicy } from "./engine/policy";
import { JevPolicy } from "./engine/jev-policy";
import { SceneRuntime } from "./engine/runtime";

import { demoPersonalities, plazaScene } from "./demo/plaza";
import { plazaShow } from "./demo/plaza-show";

import { LocalStagePolicy } from "./show/policy";
import { JevStagePolicy } from "./show/jev-stage-policy";
import { StageDirector } from "./show/stage-director";
import { ThreeShowController } from "./show/three-show";
import type { StageDecisionEvent } from "./show/model";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <div class="overlay">
    <div class="brand">
      <strong>Animachina</strong>
      <span>adaptive dark ride runtime · v0.4</span>
    </div>

    <div class="top-controls">
      <div class="personality-picker">
        ${demoPersonalities
          .map(
            (profile, index) =>
              `<button data-personality="${profile.id}" class="${index === 0 ? "active" : ""}">${profile.label}</button>`,
          )
          .join("")}
      </div>
      <button class="sound-toggle" data-sound>🔇 Sound off</button>
    </div>

    <div class="debug">
      <div><b>Beat</b> <span data-debug="beat">arrival</span></div>
      <div><b>Profile</b> <span data-debug="profile">—</span></div>
      <div><b>Vehicle</b> <span data-debug="decision">waiting…</span></div>
      <div><b>Actor</b> <span data-debug="performance">—</span></div>
      <div><b>Stage</b> <span data-debug="stage">waiting…</span></div>
    </div>

    <div class="legend">
      behavior → actor → stage direction<br />
      light · sound · scenic machinery
    </div>
  </div>
`;

const debugBeat = document.querySelector<HTMLElement>('[data-debug="beat"]')!;
const debugProfile = document.querySelector<HTMLElement>(
  '[data-debug="profile"]',
)!;
const debugDecision = document.querySelector<HTMLElement>(
  '[data-debug="decision"]',
)!;
const debugPerformance = document.querySelector<HTMLElement>(
  '[data-debug="performance"]',
)!;
const debugStage = document.querySelector<HTMLElement>(
  '[data-debug="stage"]',
)!;
const soundButton = document.querySelector<HTMLButtonElement>("[data-sound]")!;

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

const hemisphere = new THREE.HemisphereLight(0xcfd8ff, 0x31254c, 2.4);
scene.add(hemisphere);

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

type ActorFx = {
  capabilityId: string;
  intensity: number;
  duration: number;
  delay: number;
  elapsed: number;
};

const actorObjects = new Map<string, THREE.Group>();
const actorFx = new Map<string, ActorFx>();

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
      flower.position.set(
        Math.cos(angle) * radius,
        0.04,
        Math.sin(angle) * radius,
      );
      flower.rotation.x = -Math.PI / 2;
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
    group.add(body);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x211b2a }),
      );
      eye.position.set(side * 0.13, 0.1, -0.31);
      group.add(eye);
    }
  }

  actorObjects.set(actor.id, group);
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

const showController = new ThreeShowController(
  scene,
  hemisphere,
  key,
  plazaScene.actors,
  vehicle,
);

let runtime: SceneRuntime;

const stageDirector = new StageDirector(
  plazaShow,
  new JevStagePolicy(new LocalStagePolicy()),
  {
    onDecision(event: StageDecisionEvent) {
      showController.trigger(event);

      const decision = event.decision;

      debugStage.textContent =
        `${decision.lightCueId} · ${decision.soundCueId} · ${decision.setMotionCueId}` +
        ` · energy ${decision.energy.toFixed(2)}` +
        ` · ${decision.source}${decision.source === "jev" ? ` ${decision.confidence.toFixed(2)}` : ""}`;

      runtime.noteEvent(
        `stage:${decision.lightCueId}:${decision.soundCueId}:${decision.setMotionCueId}:energy=${decision.energy.toFixed(2)}`,
      );
    },
  },
);

function describeVehicleDecision(
  decision: VehicleDecision,
  opportunity: VehicleOpportunity,
) {
  const p = decision.performance;

  return (
    `${opportunity.action}${opportunity.actorId ? `:${opportunity.actorId}` : ""}` +
    ` · speed ${p.speed.toFixed(1)} · curve ${p.curvature.toFixed(2)}` +
    ` · wait ${p.hesitation.toFixed(1)}s · face ${p.facing}` +
    ` · ${decision.source}${decision.source === "jev" ? ` ${decision.confidence.toFixed(2)}` : ""}`
  );
}

function triggerActorPerformance(event: ActorPerformanceEvent) {
  actorFx.set(event.actor.id, {
    capabilityId: event.decision.capabilityId,
    intensity: event.decision.intensity,
    duration: event.decision.duration,
    delay: event.decision.delay,
    elapsed: 0,
  });

  debugPerformance.textContent =
    `${event.actor.id} → ${event.decision.capabilityId}` +
    ` · intensity ${event.decision.intensity.toFixed(2)}` +
    ` · ${event.decision.source}${event.decision.source === "jev" ? ` ${event.decision.confidence.toFixed(2)}` : ""}`;

  void stageDirector.direct(plazaScene, runtime.world, event);
}

runtime = new SceneRuntime(
  plazaScene,
  new JevPolicy(new LocalPolicy()),
  {
    onVehicleDecision(decision, opportunity) {
      debugDecision.textContent = describeVehicleDecision(decision, opportunity);
    },
    onActorPerformance: triggerActorPerformance,
    onBeatChanged(beat) {
      debugBeat.textContent = beat.id;
    },
    onComplete() {
      debugPerformance.textContent = "scene complete ✓";
    },
  },
);

let personality: PersonalityProfile = demoPersonalities[0];

function resetRide(profile: PersonalityProfile) {
  personality = profile;

  debugProfile.textContent = personality.description;
  debugDecision.textContent = "waiting…";
  debugPerformance.textContent = "—";
  debugStage.textContent = "waiting…";

  actorFx.clear();
  stageDirector.reset();
  showController.reset();
  runtime.reset(personality);
}

resetRide(personality);

document
  .querySelectorAll<HTMLButtonElement>("[data-personality]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const selected = demoPersonalities.find(
        (profile) => profile.id === button.dataset.personality,
      );

      if (!selected) return;

      document
        .querySelectorAll<HTMLButtonElement>("[data-personality]")
        .forEach((item) => item.classList.toggle("active", item === button));

      resetRide(selected);
    });
  });

soundButton.addEventListener("click", async () => {
  await showController.unlockAudio();

  soundButton.textContent = "🔊 Sound on";
  soundButton.classList.add("active");
});

const clock = new THREE.Clock();

function applyActorFx(actor: ActorDefinition, dt: number, t: number) {
  const group = actorObjects.get(actor.id);

  if (!group) return;

  group.position.set(actor.position.x, 0.08, actor.position.z);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);

  const fx = actorFx.get(actor.id);

  if (!fx) return;

  fx.elapsed += dt;

  if (fx.elapsed < fx.delay) return;

  const localTime = fx.elapsed - fx.delay;
  const progress = Math.min(1, localTime / Math.max(0.01, fx.duration));
  const envelope = Math.sin(progress * Math.PI);
  const amount = envelope * fx.intensity;

  switch (fx.capabilityId) {
    case "pulse":
      group.scale.setScalar(1 + amount * 0.28);
      break;

    case "burst":
      group.scale.setScalar(1 + amount * 0.62);
      group.rotation.y = Math.sin(t * 8) * amount * 0.16;
      break;

    case "dim":
      group.scale.setScalar(1 - amount * 0.22);
      break;

    case "turn-toward":
      group.rotation.y = amount * 0.9;
      break;

    case "turn-away":
      group.rotation.y = -amount * 1.25;
      break;

    case "pose":
      group.rotation.y = amount * Math.sin(t * 5) * 1.35;
      group.scale.set(1 + amount * 0.12, 1, 1 - amount * 0.08);
      break;

    case "bloom":
      group.scale.setScalar(1 + amount * 0.55);
      break;

    case "fold":
      group.scale.setScalar(1 - amount * 0.38);
      break;

    case "ripple":
      group.rotation.y = Math.sin(t * 10) * amount * 0.22;
      group.scale.set(1 + amount * 0.18, 1, 1 - amount * 0.08);
      break;

    case "hop":
      group.position.y = 0.08 + Math.abs(Math.sin(t * 8)) * amount * 0.8;
      break;

    case "hide":
      group.scale.setScalar(1 - amount * 0.72);
      break;

    case "circle": {
      const radius = amount * 0.45;
      group.position.x += Math.cos(t * 5) * radius;
      group.position.z += Math.sin(t * 5) * radius;
      break;
    }
  }

  if (progress >= 1) {
    actorFx.delete(actor.id);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);
  const t = performance.now() * 0.001;

  runtime.step(dt);

  const state = runtime.world.vehicle;
  vehicle.position.x = state.position.x;
  vehicle.position.z = state.position.z;
  vehicle.rotation.y = state.heading;

  for (const actor of plazaScene.actors) {
    applyActorFx(actor, dt, t);
  }

  showController.update(dt, t);

  exitMarker.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.1;
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
