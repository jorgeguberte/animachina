import type {
  Affordance,
  BeatDefinition,
  PerformanceEvent,
  Personality,
  PolicyDecision,
  SceneDefinition,
  Vec2,
  WorldState,
} from "./model";
import type { DecisionPolicy } from "./policy";

type RuntimeHooks = {
  onDecision?: (decision: PolicyDecision, affordance: Affordance) => void;
  onPerformance?: (event: PerformanceEvent) => void;
  onBeatChanged?: (beat: BeatDefinition) => void;
  onComplete?: () => void;
};

const distance = (a: Vec2, b: Vec2) =>
  Math.hypot(b.x - a.x, b.z - a.z);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export class SceneRuntime {
  readonly world: WorldState;

  private activeAffordance?: Affordance;
  private pendingDecision = false;
  private dwellRemaining = 0;
  private lastMove = { x: 0, z: 1 };

  constructor(
    readonly scene: SceneDefinition,
    private readonly policy: DecisionPolicy,
    private readonly hooks: RuntimeHooks = {},
  ) {
    this.world = {
      sceneId: scene.id,
      elapsed: 0,
      beatId: scene.firstBeatId,
      vehicle: {
        position: { ...scene.entry },
        heading: 0,
        speed: 0,
        personality: "glamorous",
        style: "neutral",
      },
      actors: Object.fromEntries(
        scene.actors.map((actor) => [
          actor.id,
          { id: actor.id, attention: 0 },
        ]),
      ),
      recentEvents: [],
      completed: false,
    };
  }

  reset(personality: Personality) {
    this.world.elapsed = 0;
    this.world.beatId = this.scene.firstBeatId;
    this.world.vehicle = {
      position: { ...this.scene.entry },
      heading: 0,
      speed: 0,
      personality,
      style: "neutral",
    };
    this.world.actors = Object.fromEntries(
      this.scene.actors.map((actor) => [
        actor.id,
        { id: actor.id, attention: 0 },
      ]),
    );
    this.world.recentEvents = [];
    this.world.completed = false;

    this.activeAffordance = undefined;
    this.pendingDecision = false;
    this.dwellRemaining = 0;
    this.lastMove = { x: 0, z: 1 };

    this.hooks.onBeatChanged?.(this.currentBeat());
  }

  step(dt: number) {
    if (this.world.completed) return;

    this.world.elapsed += dt;

    if (this.dwellRemaining > 0) {
      this.dwellRemaining -= dt;
      this.world.vehicle.speed = 0;

      if (this.dwellRemaining <= 0) {
        this.advanceBeat();
      }
      return;
    }

    if (!this.activeAffordance) {
      void this.requestDecision();
      return;
    }

    this.moveVehicle(dt, this.activeAffordance);
  }

  private currentBeat(): BeatDefinition {
    const beat = this.scene.beats.find(
      (candidate) => candidate.id === this.world.beatId,
    );

    if (!beat) {
      throw new Error(`Unknown beat: ${this.world.beatId}`);
    }

    return beat;
  }

  private async requestDecision() {
    if (this.pendingDecision || this.world.completed) return;

    this.pendingDecision = true;
    const beat = this.currentBeat();

    try {
      const decision = await this.policy.choose({
        scene: this.scene,
        world: this.world,
        beat,
        availableAffordances: beat.affordances,
      });

      const selected = beat.affordances.find(
        (affordance) => affordance.id === decision.affordanceId,
      );

      if (!selected) {
        throw new Error(
          `Policy selected unavailable affordance: ${decision.affordanceId}`,
        );
      }

      this.world.vehicle.currentAffordanceId = selected.id;
      this.world.vehicle.style = decision.style;
      this.activeAffordance = selected;

      this.pushEvent(
        `decision:${beat.id}:${selected.id}:${decision.style}`,
      );

      this.hooks.onDecision?.(decision, selected);
    } finally {
      this.pendingDecision = false;
    }
  }

  private moveVehicle(dt: number, affordance: Affordance) {
    const position = this.world.vehicle.position;
    const target = affordance.target;

    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const remaining = Math.hypot(dx, dz);

    if (remaining < 0.08) {
      position.x = target.x;
      position.z = target.z;
      this.world.vehicle.speed = 0;
      this.arrive(affordance);
      return;
    }

    const direction = {
      x: dx / remaining,
      z: dz / remaining,
    };

    const style = this.world.vehicle.style;

    const desiredSpeed =
      style === "showy"
        ? 2.45
        : style === "careful"
          ? 1.45
          : style === "impulsive"
            ? 2.85
            : 2.0;

    // Enough steering variation to make personality visible while remaining
    // deterministic and renderer-independent.
    const progress = clamp01(1 - remaining / 8);
    const flourish =
      style === "showy"
        ? Math.sin(progress * Math.PI * 2) * 0.28
        : style === "careful"
          ? Math.sin(progress * Math.PI) * 0.08
          : style === "impulsive"
            ? Math.sin(progress * Math.PI * 5) * 0.17
            : 0;

    const tangent = { x: -direction.z, z: direction.x };
    const move = {
      x: direction.x + tangent.x * flourish,
      z: direction.z + tangent.z * flourish,
    };

    const moveLength = Math.hypot(move.x, move.z) || 1;
    move.x /= moveLength;
    move.z /= moveLength;

    const step = Math.min(remaining, desiredSpeed * dt);
    position.x += move.x * step;
    position.z += move.z * step;

    this.lastMove = move;
    this.world.vehicle.speed = desiredSpeed;
    this.world.vehicle.heading = Math.atan2(move.x, move.z);
  }

  private arrive(affordance: Affordance) {
    const beat = this.currentBeat();
    const actor = affordance.actorId
      ? this.scene.actors.find((item) => item.id === affordance.actorId)
      : undefined;

    this.pushEvent(`arrived:${affordance.id}`);

    if (actor) {
      const actorState = this.world.actors[actor.id];
      actorState.attention = 1;
      actorState.performance = `${this.world.vehicle.style}:${affordance.action}`;
    }

    this.hooks.onPerformance?.({
      beatId: beat.id,
      affordance,
      actor,
      personality: this.world.vehicle.personality,
      style: this.world.vehicle.style,
    });

    this.activeAffordance = undefined;
    this.world.vehicle.currentAffordanceId = undefined;

    this.dwellRemaining = affordance.action === "exit" ? 0.25 : 1.35;
  }

  private advanceBeat() {
    const beat = this.currentBeat();

    if (!beat.nextBeatId) {
      this.world.completed = true;
      this.world.vehicle.speed = 0;
      this.pushEvent("scene:complete");
      this.hooks.onComplete?.();
      return;
    }

    this.world.beatId = beat.nextBeatId;
    this.pushEvent(`beat:${beat.nextBeatId}`);
    this.hooks.onBeatChanged?.(this.currentBeat());
  }

  private pushEvent(event: string) {
    this.world.recentEvents.push(event);
    this.world.recentEvents = this.world.recentEvents.slice(-12);
  }
}
