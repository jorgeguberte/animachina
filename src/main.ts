import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildGarden, buildActor, buildVehicle } from "./scene/garden";
import { composeStory } from "./engine/story";
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
  <aside class="sidebar">
    <a class="brand" href="#" aria-label="Animachina home"><span class="brand-mark">✳</span> animachina<span class="edition">ATELIER / 05</span></a>
    <div class="scene-copy"><p class="eyebrow">A LIVING ATTRACTION · SCENE 001</p><h1>Moonlit<br/><em>Plaza.</em></h1><p class="intro">A little world that<br/>notices you're here.</p><div class="hairline"></div><p class="description">Water whispers. Brass remembers.<br/>Somewhere in the garden,<br/>a creature is waiting to meet you.</p></div>
    <section class="guest-controls" aria-labelledby="guest-heading"><p class="eyebrow" id="guest-heading">01 / WHO ARRIVES TONIGHT?</p>
      <div class="personality-picker">${demoPersonalities.map((profile, index) => `<button data-personality="${profile.id}" aria-pressed="${index === 0}" class="${index === 0 ? "active" : ""}">${profile.label}</button>`).join("")}</div>
      <p class="profile-description" data-debug="profile"></p>
      <details class="custom-profile"><summary>Bring your own character <span>＋</span></summary><form data-profile-form><label for="character">Describe your visitor</label><textarea id="character" maxlength="600" placeholder="A retired magician, trying to believe in wonder again…" required></textarea><button type="submit">Enter the garden ↗</button></form></details>
    </section>
    <details class="creative"><summary>Dream up a different story <span>✧</span></summary><form data-story-form><label for="story">What should this encounter feel like?</label><textarea id="story" maxlength="600" placeholder="A forgotten garden waking up for its last visitor…" required></textarea><button type="submit" data-story-submit>Compose with DiffusionGemma ↗</button><p class="form-status" data-story-status role="status"></p></form></details>
    <footer class="sidebar-footer"><span>BUILT FOR WONDER</span><span>Every visit, a new performance.</span></footer>
  </aside>
  <main class="stage" aria-label="Animated Moonlit Plaza">
    <div class="stage-top"><span class="live-indicator" data-source>● &nbsp; AWAITING DIRECTION</span><button data-inspect aria-expanded="false">Behind the magic <span>↗</span></button></div>
    <div class="viewport"></div><div class="vignette"></div>
    <div class="scene-caption"><span class="eyebrow">THE GARDEN AFTER DARK</span><span>Est. somewhere between a dream & a machine</span></div>
    <div class="moment"><span class="eyebrow" data-beat-label>01 / ARRIVAL</span><p data-moment aria-live="polite">The garden is holding its breath.</p><div class="beat-track">${plazaScene.beats.map((beat, i) => `<span data-beat="${beat.id}"><i></i>${String(i + 1).padStart(2, "0")} ${beat.id}</span>`).join("")}</div></div>
    <div class="transport"><div><button data-pause aria-label="Pause performance">Ⅱ <span>Pause</span></button><button data-replay aria-label="Replay performance">↻ <span>Again</span></button></div><div class="view-controls" role="group" aria-label="Camera view"><button data-camera="garden" class="active" aria-pressed="true">Garden</button><button data-camera="overhead" aria-pressed="false">Plan</button><button data-camera="ride" aria-pressed="false">Follow</button></div><div><button data-motion aria-pressed="false" title="Reduce ambient motion">◌ <span>Motion</span></button><button data-sound aria-pressed="false">♫ <span>Sound off</span></button></div></div>
    <section class="debug" hidden aria-label="Live performance inspector"><div class="inspector-heading">LIVE DIRECTION <button data-close-inspector aria-label="Close inspector">×</button></div><div><b>Beat</b> <span data-debug="beat">arrival</span></div><div><b>Vehicle</b> <span data-debug="decision">waiting…</span></div><div><b>Actor</b> <span data-debug="performance">—</span></div><div><b>Stage</b> <span data-debug="stage">waiting…</span></div><p>Jev chooses from physical capabilities. The local fallback is intentionally personality-blind.</p></section>
  </main>
`;
const viewport = document.querySelector<HTMLDivElement>(".viewport")!;
const momentText = document.querySelector<HTMLElement>("[data-moment]")!;
const sourceLabel = document.querySelector<HTMLElement>("[data-source]")!;
let paused = false;
let reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let cameraMode = "garden";
let rideGeneration = 0;
let soundWanted = false;
let currentScene = structuredClone(plazaScene);
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
const debugStage = document.querySelector<HTMLElement>('[data-debug="stage"]')!;
const soundButton = document.querySelector<HTMLButtonElement>("[data-sound]")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09181f);
scene.fog = new THREE.Fog(0x09181f, 26, 55);

const aspect = viewport.clientWidth / viewport.clientHeight;
let frustumHeight = Math.max(13.8, 18 / aspect);
const camera = new THREE.OrthographicCamera(
  (-frustumHeight * aspect) / 2,
  (frustumHeight * aspect) / 2,
  frustumHeight / 2,
  -frustumHeight / 2,
  0.1,
  100,
);
camera.position.set(8, 13, 16);
camera.up.set(0, 1, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);
renderer.domElement.setAttribute(
  "aria-label",
  "An illuminated mechanical garden with five performers and a ride vehicle",
);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(viewport.clientWidth, viewport.clientHeight),
  0.32,
  0.55,
  0.85,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemisphere = new THREE.HemisphereLight(0xb7ddeb, 0x15242c, 1.7);
scene.add(hemisphere);

const key = new THREE.DirectionalLight(0xffdfae, 3.2);
key.position.set(-5, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9;
key.shadow.camera.right = 9;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -9;
key.shadow.normalBias = 0.035;
scene.add(key);

const updateGarden = buildGarden(scene);

type ActorFx = {
  capabilityId: string;
  intensity: number;
  duration: number;
  delay: number;
  elapsed: number;
};

const actorObjects = new Map<string, THREE.Group>();
const actorFx = new Map<string, ActorFx>();

for (const actor of plazaScene.actors) {
  const group = buildActor(actor);
  actorObjects.set(actor.id, group);
  scene.add(group);
}

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

const vehicle = buildVehicle();
vehicle.position.y = 0.08;
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

async function triggerActorPerformance(event: ActorPerformanceEvent) {
  const generation = rideGeneration;
  const stage = await stageDirector.direct(currentScene, runtime.world, event);
  if (generation !== rideGeneration) return;
  momentText.textContent = `${actorNames[event.actor.id] ?? event.actor.id} · ${event.actor.capabilities.find((c) => c.id === event.decision.capabilityId)?.description ?? event.decision.capabilityId}`;
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

  return stage ? stage.anticipation + stage.sustain + 0.94 : 0;
}

const actorNames: Record<string, string> = {
  fountain: "The wishing fountain",
  statue: "The keeper",
  flowers: "The whispering blooms",
  creature: "The little clockwork fox",
  lantern: "The wandering light",
};

function createRuntime() {
  return new SceneRuntime(currentScene, new JevPolicy(new LocalPolicy()), {
    onVehicleDecision(decision, opportunity) {
      debugDecision.textContent = describeVehicleDecision(
        decision,
        opportunity,
      );
      sourceLabel.textContent =
        decision.source === "jev"
          ? "●  JEV · LIVE DIRECTION"
          : "○  LOCAL · EXPLORATION";
      sourceLabel.dataset.mode = decision.source;
      momentText.textContent =
        opportunity.action === "exit"
          ? "Carrying a little of the garden home."
          : `${opportunity.action === "observe" ? "A quiet look at" : opportunity.action === "orbit" ? "A new perspective on" : opportunity.action === "linger" ? "A moment with" : "An encounter with"} ${(actorNames[opportunity.actorId ?? ""] ?? "the garden").toLowerCase()}.`;
    },
    onActorPerformance: triggerActorPerformance,
    onBeatChanged(beat) {
      debugBeat.textContent = beat.id;
      const index = currentScene.beats.findIndex((b) => b.id === beat.id);
      document.querySelector("[data-beat-label]")!.textContent =
        `${String(index + 1).padStart(2, "0")} / ${beat.id.toUpperCase()}`;
      document.querySelectorAll<HTMLElement>("[data-beat]").forEach((el, i) => {
        el.classList.toggle("current", i === index);
        el.classList.toggle("done", i < index);
      });
    },
    onError(error) {
      console.warn("[Animachina] performance recovered", error);
      momentText.textContent =
        "A little pause. The garden is finding its rhythm.";
    },
    onComplete() {
      debugPerformance.textContent = "scene complete ✓";
      momentText.textContent =
        "The garden remembers. Come back as someone new.";
      sourceLabel.textContent = "✧  PERFORMANCE COMPLETE";
      document
        .querySelectorAll("[data-beat]")
        .forEach((el) => el.classList.add("done"));
    },
  });
}
runtime = createRuntime();

let personality: PersonalityProfile = demoPersonalities[0];

function resetRide(profile: PersonalityProfile) {
  personality = profile;
  rideGeneration += 1;
  paused = false;
  updatePauseButton();
  if (soundWanted) void showController.unlockAudio();

  debugProfile.textContent = personality.description;
  debugDecision.textContent = "waiting…";
  debugPerformance.textContent = "—";
  debugStage.textContent = "waiting…";
  sourceLabel.textContent = "●  AWAITING DIRECTION";
  momentText.textContent = "The garden is holding its breath.";

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
        .forEach((item) => {
          item.classList.toggle("active", item === button);
          item.setAttribute("aria-pressed", String(item === button));
        });

      resetRide(selected);
    });
  });

soundButton.addEventListener("click", async () => {
  try {
    soundWanted = !soundWanted;
    await showController.setAudioEnabled(soundWanted && !paused);
    soundButton.innerHTML = `♫ <span>Sound ${soundWanted ? "on" : "off"}</span>`;
    soundButton.setAttribute("aria-pressed", String(soundWanted));
  } catch {
    soundWanted = false;
    soundButton.textContent = "Sound unavailable";
  }
});

function updatePauseButton() {
  const button = document.querySelector<HTMLButtonElement>("[data-pause]")!;
  button.innerHTML = paused ? "▶ <span>Resume</span>" : "Ⅱ <span>Pause</span>";
  button.setAttribute(
    "aria-label",
    paused ? "Resume performance" : "Pause performance",
  );
}
document.querySelector("[data-pause]")!.addEventListener("click", () => {
  paused = !paused;
  updatePauseButton();
  if (soundWanted) void showController.setAudioEnabled(!paused);
});
document
  .querySelector("[data-replay]")!
  .addEventListener("click", () => resetRide(personality));
document
  .querySelectorAll<HTMLButtonElement>("[data-camera]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      cameraMode = button.dataset.camera!;
      document
        .querySelectorAll<HTMLButtonElement>("[data-camera]")
        .forEach((b) => {
          b.classList.toggle("active", b === button);
          b.setAttribute("aria-pressed", String(b === button));
        });
    }),
  );
const motionButton =
  document.querySelector<HTMLButtonElement>("[data-motion]")!;
function updateMotionButton() {
  motionButton.setAttribute("aria-pressed", String(reducedMotion));
  motionButton.innerHTML = `◌ <span>${reducedMotion ? "Calm" : "Motion"}</span>`;
}
updateMotionButton();
motionButton.addEventListener("click", () => {
  reducedMotion = !reducedMotion;
  updateMotionButton();
});
const inspector = document.querySelector<HTMLElement>(".debug")!;
const inspectButton =
  document.querySelector<HTMLButtonElement>("[data-inspect]")!;
function toggleInspector(open: boolean) {
  inspector.hidden = !open;
  inspectButton.setAttribute("aria-expanded", String(open));
}
inspectButton.addEventListener("click", () =>
  toggleInspector(inspector.hidden),
);
document
  .querySelector("[data-close-inspector]")!
  .addEventListener("click", () => toggleInspector(false));
addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleInspector(false);
});
document
  .querySelector("[data-profile-form]")!
  .addEventListener("submit", (event) => {
    event.preventDefault();
    const description = document
      .querySelector<HTMLTextAreaElement>("#character")!
      .value.trim();
    if (!description) return;
    document.querySelectorAll("[data-personality]").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    resetRide({ id: "custom", label: "Your visitor", description });
  });
document
  .querySelector("[data-story-form]")!
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = document
      .querySelector<HTMLTextAreaElement>("#story")!
      .value.trim();
    if (!prompt) return;
    const button = document.querySelector<HTMLButtonElement>(
      "[data-story-submit]",
    )!;
    const status = document.querySelector<HTMLElement>("[data-story-status]")!;
    button.disabled = true;
    status.textContent = "Composing a new dramatic intention…";
    try {
      const story = await composeStory(prompt);
      currentScene = structuredClone(plazaScene);
      currentScene.creativeIntent = story.intent;
      currentScene.beats.forEach((beat) => {
        beat.intent = story.beats[beat.id] ?? beat.intent;
      });
      stageDirector.reset();
      runtime.reset(personality); // Invalidate work still awaiting an older policy response.
      runtime = createRuntime();
      resetRide(personality);
      status.textContent = `Now playing: ${story.title}`;
      document.querySelector(".scene-caption > span:last-child")!.textContent =
        story.title;
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not compose this story. Your current performance is unchanged.";
    } finally {
      button.disabled = false;
    }
  });

const clock = new THREE.Clock();

function applyActorFx(actor: ActorDefinition, dt: number, t: number) {
  const group = actorObjects.get(actor.id);

  if (!group) return;

  group.position.set(actor.position.x, 0.08, actor.position.z);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
  group.getObjectByName("jets")?.scale.setScalar(1);
  group.getObjectByName("lantern")?.scale.setScalar(1);

  const fx = actorFx.get(actor.id);

  if (!fx) {
    if (!reducedMotion) {
      if (actor.kind === "creature")
        group.scale.y = 1 + Math.sin(t * 2) * 0.025;
      if (actor.kind === "flowers")
        group.rotation.z = Math.sin(t * 0.8) * 0.025;
      const jets = group.getObjectByName("jets");
      if (jets) jets.scale.y = 1 + Math.sin(t * 2) * 0.05;
      const lantern = group.getObjectByName("lantern");
      if (lantern) lantern.rotation.z = Math.sin(t) * 0.06;
    }
    return;
  }

  fx.elapsed += dt;

  if (fx.elapsed < fx.delay) return;

  const localTime = fx.elapsed - fx.delay;
  const progress = Math.min(1, localTime / Math.max(0.01, fx.duration));
  const envelope = Math.sin(progress * Math.PI);
  const amount = envelope * fx.intensity;

  switch (fx.capabilityId) {
    case "pulse":
      group.getObjectByName("jets")?.scale.set(1, 1 + amount * 0.7, 1);
      break;

    case "burst":
      group
        .getObjectByName("jets")
        ?.scale.set(1 + amount * 0.15, 1 + amount * 1.25, 1 + amount * 0.15);
      group.rotation.y = Math.sin(t * 8) * amount * 0.16;
      break;

    case "dim":
      group.getObjectByName("jets")?.scale.set(1, 1 - amount * 0.8, 1);
      break;

    case "turn-toward":
      group.rotation.y =
        Math.atan2(
          vehicle.position.x - group.position.x,
          vehicle.position.z - group.position.z,
        ) * amount;
      break;

    case "turn-away":
      group.rotation.y =
        (Math.atan2(
          vehicle.position.x - group.position.x,
          vehicle.position.z - group.position.z,
        ) +
          Math.PI) *
        amount;
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

    case "beckon":
      group.rotation.z = Math.sin(t * 4) * amount * 0.15;
      break;
    case "glimmer":
      group
        .getObjectByName("lantern")
        ?.scale.setScalar(1 + Math.sin(t * 6) * amount * 0.2);
      break;
    case "bow":
      group.rotation.z = amount * 0.25;
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

let sceneTime = 0;
const cameraTarget = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);

  const realDt = Math.min(clock.getDelta(), 0.04);
  const dt = paused ? 0 : realDt;
  sceneTime += dt;
  const t = sceneTime;
  if (!paused) runtime.step(dt);

  const state = runtime.world.vehicle;
  vehicle.position.x = state.position.x;
  vehicle.position.z = state.position.z;
  const headingDelta = Math.atan2(
    Math.sin(state.heading - vehicle.rotation.y),
    Math.cos(state.heading - vehicle.rotation.y),
  );
  vehicle.rotation.y += headingDelta * (1 - Math.exp(-dt * 8));
  vehicle.position.y = 0.08 + (reducedMotion ? 0 : Math.sin(t * 2) * 0.015);
  updateGarden(t, reducedMotion);

  for (const actor of plazaScene.actors) {
    applyActorFx(actor, dt, t);
  }

  showController.update(dt, t);

  exitMarker.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.1;
  exitMarker.rotation.z += dt * 0.18;

  const following = cameraMode === "ride";
  const target = following
    ? new THREE.Vector3(state.position.x * 0.65, 0, state.position.z * 0.65)
    : new THREE.Vector3();
  cameraTarget.lerp(target, 1 - Math.exp(-realDt * 2));
  cameraPosition
    .copy(
      cameraMode === "overhead"
        ? new THREE.Vector3(0, 20, 0.001)
        : following
          ? new THREE.Vector3(6, 10, 11)
          : new THREE.Vector3(8, 13, 16),
    )
    .add(cameraTarget);
  camera.position.lerp(
    cameraPosition,
    reducedMotion ? 1 : 1 - Math.exp(-realDt * 3),
  );
  camera.lookAt(cameraTarget);
  const targetZoom = following ? 1.35 : 1;
  camera.zoom += (targetZoom - camera.zoom) * (1 - Math.exp(-realDt * 3));
  camera.updateProjectionMatrix();
  composer.render();
}

animate();

new ResizeObserver(() => {
  const nextAspect = viewport.clientWidth / viewport.clientHeight;
  frustumHeight = Math.max(13.8, 18 / nextAspect);
  camera.left = (-frustumHeight * nextAspect) / 2;
  camera.right = (frustumHeight * nextAspect) / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  composer.setSize(viewport.clientWidth, viewport.clientHeight);
}).observe(viewport);
