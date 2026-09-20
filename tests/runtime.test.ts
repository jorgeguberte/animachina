import test from "node:test";
import assert from "node:assert/strict";
import { SceneRuntime } from "../src/engine/runtime";
import { planPath, pathLength, pointOnPath } from "../src/engine/movement";
import { parseStory } from "../src/engine/story";
import { StageDirector } from "../src/show/stage-director";
import { plazaScene, demoPersonalities } from "../src/demo/plaza";
import { plazaShow } from "../src/demo/plaza-show";
import type { ActorDecision, VehicleDecision } from "../src/engine/model";

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const vehicle = (id: string): VehicleDecision => ({
  opportunityId: id,
  performance: {
    speed: 2,
    curvature: 0.4,
    hesitation: 0,
    dwell: 0.1,
    facing: "target",
  },
  confidence: 1,
  source: "local",
});
const actor: ActorDecision = {
  actorId: "lantern",
  capabilityId: "bow",
  intensity: 0.5,
  duration: 1,
  delay: 0.1,
  confidence: 1,
  source: "local",
};

// Each generic action against every performer, from many spatial starting states.
test("routes remain in bounds and clear of physical performers", () => {
  const runtime = new SceneRuntime(plazaScene, {
    chooseVehicle: async () => vehicle("exit:scene"),
    chooseActor: async () => null,
  });
  const starts = [
    plazaScene.entry,
    plazaScene.exit,
    ...runtime.getAvailableOpportunities().map((o) => o.target),
  ];
  for (const start of starts) {
    runtime.world.vehicle.position = { ...start };
    for (const opportunity of runtime.getAvailableOpportunities()) {
      for (const curvature of [-0.46, 0, 0.46]) {
        const path = planPath(plazaScene, start, opportunity.target, curvature);
        const length = pathLength(path);
        for (let i = 0; i <= 100; i++) {
          const p = pointOnPath(path, i / 100, length);
          assert.ok(p.x >= -8 && p.x <= 8 && p.z >= -5 && p.z <= 5);
          for (const a of plazaScene.actors)
            assert.ok(
              Math.hypot(p.x - a.position.x, p.z - a.position.z) >=
                a.interactionRadius * 0.7 + 0.2 - 1e-5,
              `${opportunity.id} intersects ${a.id}`,
            );
        }
        assert.deepEqual(pointOnPath(path, 1, length), opportunity.target);
      }
    }
  }
});

test("arrival holds for delayed actor and stage, then completes all beats", async () => {
  let releaseActor!: (value: ActorDecision) => void;
  let releaseStage!: (value: number) => void;
  let actorCalls = 0;
  const runtime = new SceneRuntime(
    plazaScene,
    {
      chooseVehicle: async (c) => vehicle(c.opportunities[0].id),
      chooseActor: async () => {
        actorCalls++;
        return actorCalls === 1
          ? new Promise((resolve) => {
              releaseActor = resolve;
            })
          : actor;
      },
    },
    {
      onActorPerformance: async () =>
        actorCalls === 1
          ? new Promise((resolve) => {
              releaseStage = resolve;
            })
          : 0,
    },
  );
  runtime.reset(demoPersonalities[0]);
  runtime.step(0.04);
  await flush();
  for (let i = 0; i < 500; i++) runtime.step(0.04);
  assert.equal(actorCalls, 1);
  assert.equal(runtime.world.interactionsInBeat, 1);
  const position = { ...runtime.world.vehicle.position };
  releaseActor(actor);
  await flush();
  for (let i = 0; i < 500; i++) runtime.step(0.04);
  assert.deepEqual(runtime.world.vehicle.position, position);
  releaseStage(2);
  await flush();
  for (let i = 0; i < 20; i++) runtime.step(0.04);
  assert.equal(actorCalls, 1);
  for (let i = 0; i < 5000 && !runtime.world.completed; i++) {
    runtime.step(0.04);
    await flush();
  }
  assert.equal(runtime.world.completed, true);
  assert.equal(actorCalls, 5);
  assert.deepEqual(runtime.world.vehicle.position, plazaScene.exit);
});

test("reset discards an old actor response and keeps the new ride intact", async () => {
  let release!: (value: ActorDecision) => void;
  let performances = 0;
  const runtime = new SceneRuntime(
    plazaScene,
    {
      chooseVehicle: async (c) => vehicle(c.opportunities[0].id),
      chooseActor: async () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
    {
      onActorPerformance: () => {
        performances++;
      },
    },
  );
  runtime.reset(demoPersonalities[0]);
  runtime.step(0.04);
  await flush();
  for (let i = 0; i < 500; i++) runtime.step(0.04);
  runtime.reset(demoPersonalities[1]);
  release(actor);
  await flush();
  assert.equal(performances, 0);
  assert.equal(runtime.world.interactionsInBeat, 0);
  assert.equal(runtime.world.vehicle.personality.id, demoPersonalities[1].id);
  assert.deepEqual(runtime.world.vehicle.position, plazaScene.entry);
});

test("stage direction snapshots state and discards superseded responses", async () => {
  const pending: Array<(value: any) => void> = [];
  const received: string[] = [];
  const runtime = new SceneRuntime(plazaScene, {
    chooseVehicle: async () => vehicle("exit:scene"),
    chooseActor: async () => null,
  });
  const director = new StageDirector(
    plazaShow,
    {
      direct: async (context) => {
        assert.notEqual(context.world, runtime.world);
        return new Promise((resolve) => pending.push(resolve));
      },
    },
    { onDecision: (event) => received.push(event.decision.lightCueId) },
  );
  const moment = {
    beatId: "arrival",
    actor: plazaScene.actors[0],
    decision: actor,
  };
  const first = director.direct(plazaScene, runtime.world, moment),
    second = director.direct(plazaScene, runtime.world, moment);
  pending[1]({ lightCueId: "new" });
  await second;
  pending[0]({ lightCueId: "old" });
  await first;
  assert.deepEqual(received, ["new"]);
  const third = director.direct(plazaScene, runtime.world, moment);
  director.reset();
  pending[2]({ lightCueId: "stale" });
  await third;
  assert.deepEqual(received, ["new"]);
});

test("creative output can change intent but cannot introduce executable capabilities", () => {
  assert.throws(() => parseStory({ title: "x", intent: "x", beats: {} }));
  assert.throws(() =>
    parseStory({ title: "x".repeat(101), intent: "x", beats: {} }),
  );
  const story = parseStory({
    title: " A memory ",
    intent: " Wonder ",
    beats: {
      arrival: "Hello",
      discovery: "Discover",
      farewell: "Remember",
      departure: "Leave",
      invented: "Explode",
    },
    actors: [{ kind: "invented" }],
  });
  assert.equal(story.title, "A memory");
  assert.equal(Object.keys(story.beats).length, 4);
  assert.equal("actors" in story, false);
});
