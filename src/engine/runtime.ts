import { planPath, pathLength, pointOnPath } from "./movement";
import type {
  ActorDefinition,
  ActorPerformanceEvent,
  BeatDefinition,
  PersonalityProfile,
  SceneDefinition,
  Vec2,
  VehicleDecision,
  VehicleOpportunity,
  VehiclePerformanceEvent,
  WorldState,
} from "./model";
import type { DecisionPolicy } from "./policy";

type RuntimeHooks = {
  onVehicleDecision?: (
    decision: VehicleDecision,
    opportunity: VehicleOpportunity,
  ) => void;
  onVehiclePerformance?: (event: VehiclePerformanceEvent) => void;
  onActorPerformance?: (
    event: ActorPerformanceEvent,
  ) => Promise<number | void> | number | void;
  onError?: (error: unknown) => void;
  onBeatChanged?: (beat: BeatDefinition) => void;
  onComplete?: () => void;
};

const normalize = (value: Vec2): Vec2 => {
  const length = Math.hypot(value.x, value.z);

  if (length < 0.0001) {
    return { x: -1, z: 0 };
  }

  return {
    x: value.x / length,
    z: value.z / length,
  };
};

const rotated90 = (value: Vec2): Vec2 => ({
  x: -value.z,
  z: value.x,
});

export class SceneRuntime {
  readonly world: WorldState;

  private activeOpportunity?: VehicleOpportunity;
  private activeDecision?: VehicleDecision;
  private pendingVehicleDecision = false;
  private pendingActor = false;
  private travelPath: Vec2[] = [];
  private travelLength = 0;
  private travelProgress = 0;
  private travelDuration = 1;
  private generation = 0;
  private hesitationRemaining = 0;
  private dwellRemaining = 0;

  constructor(
    readonly scene: SceneDefinition,
    private readonly policy: DecisionPolicy,
    private readonly hooks: RuntimeHooks = {},
  ) {
    const personality: PersonalityProfile = {
      id: "unassigned",
      label: "Unassigned",
      description: "No personality profile has been selected.",
    };

    this.world = {
      sceneId: scene.id,
      elapsed: 0,
      beatId: scene.firstBeatId,
      interactionsInBeat: 0,
      vehicle: {
        position: { ...scene.entry },
        heading: 0,
        speed: 0,
        personality,
      },
      actors: Object.fromEntries(
        scene.actors.map((actor) => [actor.id, { id: actor.id, attention: 0 }]),
      ),
      recentEvents: [],
      completed: false,
    };
  }

  reset(personality: PersonalityProfile) {
    this.generation += 1;
    this.world.elapsed = 0;
    this.world.beatId = this.scene.firstBeatId;
    this.world.interactionsInBeat = 0;
    this.world.vehicle = {
      position: { ...this.scene.entry },
      heading: 0,
      speed: 0,
      personality,
    };
    this.world.actors = Object.fromEntries(
      this.scene.actors.map((actor) => [
        actor.id,
        { id: actor.id, attention: 0 },
      ]),
    );
    this.world.recentEvents = [];
    this.world.completed = false;

    this.activeOpportunity = undefined;
    this.activeDecision = undefined;
    this.pendingVehicleDecision = false;
    this.pendingActor = false;
    this.hesitationRemaining = 0;
    this.dwellRemaining = 0;

    this.hooks.onBeatChanged?.(this.currentBeat());
  }

  noteEvent(event: string) {
    this.pushEvent(event);
  }

  step(dt: number) {
    if (this.world.completed) return;

    dt = Math.max(0, Math.min(0.05, dt));
    this.world.elapsed += dt;
    if (this.pendingActor) return;

    if (this.hesitationRemaining > 0) {
      this.hesitationRemaining -= dt;
      this.world.vehicle.speed = 0;
      return;
    }

    if (this.dwellRemaining > 0) {
      this.dwellRemaining -= dt;
      this.world.vehicle.speed = 0;

      if (this.dwellRemaining <= 0) {
        this.finishInteraction();
      }

      return;
    }

    if (!this.activeOpportunity || !this.activeDecision) {
      void this.requestVehicleDecision();
      return;
    }

    this.moveVehicle(dt, this.activeOpportunity, this.activeDecision);
  }

  getAvailableOpportunities(): VehicleOpportunity[] {
    const beat = this.currentBeat();
    const opportunities: VehicleOpportunity[] = [];

    for (const action of beat.availableActions) {
      if (action === "exit") {
        opportunities.push({
          id: "exit:scene",
          action,
          target: { ...this.scene.exit },
          description: "Continue through the scene exit.",
          tags: ["transition"],
        });
        continue;
      }

      for (const actor of this.scene.actors) {
        opportunities.push({
          id: `${action}:${actor.id}`,
          action,
          actorId: actor.id,
          target: this.interactionTarget(actor, action),
          description: `${action} ${actor.kind} "${actor.id}"`,
          tags: [...actor.tags, action],
        });
      }
    }

    return opportunities;
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

  private interactionTarget(
    actor: ActorDefinition,
    action: VehicleOpportunity["action"],
  ): Vec2 {
    const fromActorToVehicle = normalize({
      x: this.world.vehicle.position.x - actor.position.x,
      z: this.world.vehicle.position.z - actor.position.z,
    });

    const radiusMultiplier =
      action === "observe"
        ? 1.55
        : action === "linger"
          ? 1.35
          : action === "orbit"
            ? 1.15
            : 1;

    let direction = fromActorToVehicle;

    if (action === "orbit") {
      direction = rotated90(fromActorToVehicle);
    }

    return {
      x:
        actor.position.x +
        direction.x * actor.interactionRadius * radiusMultiplier,
      z:
        actor.position.z +
        direction.z * actor.interactionRadius * radiusMultiplier,
    };
  }

  private async requestVehicleDecision() {
    if (this.pendingVehicleDecision || this.world.completed) return;

    this.pendingVehicleDecision = true;
    const generation = this.generation;
    const beat = this.currentBeat();
    const opportunities = this.getAvailableOpportunities();

    try {
      const decision = await this.policy.chooseVehicle({
        scene: this.scene,
        world: structuredClone(this.world),
        beat,
        personality: this.world.vehicle.personality,
        opportunities,
      });

      if (generation !== this.generation) return;

      const selected = opportunities.find(
        (opportunity) => opportunity.id === decision.opportunityId,
      );

      if (!selected) {
        throw new Error(
          `Policy selected unavailable opportunity: ${decision.opportunityId}`,
        );
      }

      const travelPath = planPath(
        this.scene,
        this.world.vehicle.position,
        selected.target,
        decision.performance.curvature,
      );
      this.world.vehicle.currentOpportunityId = selected.id;
      this.world.vehicle.performance = decision.performance;
      this.activeOpportunity = selected;
      this.activeDecision = decision;
      this.travelPath = travelPath;
      this.travelLength = pathLength(travelPath);
      this.travelProgress = 0;
      this.travelDuration = Math.max(
        0.65,
        (this.travelLength / Math.max(0.2, decision.performance.speed)) * 1.5,
      );
      this.hesitationRemaining = Math.max(0, decision.performance.hesitation);

      this.pushEvent(
        `vehicle:${beat.id}:${selected.id}:speed=${decision.performance.speed.toFixed(2)}`,
      );

      this.hooks.onVehicleDecision?.(decision, selected);
    } catch (error) {
      if (generation === this.generation) {
        this.hesitationRemaining = 1;
        this.hooks.onError?.(error);
      }
    } finally {
      if (generation === this.generation) {
        this.pendingVehicleDecision = false;
      }
    }
  }

  private moveVehicle(
    dt: number,
    opportunity: VehicleOpportunity,
    decision: VehicleDecision,
  ) {
    const position = this.world.vehicle.position;
    this.travelProgress = Math.min(
      1,
      this.travelProgress + dt / this.travelDuration,
    );
    const u = this.travelProgress;
    const eased = u * u * (3 - 2 * u);
    const oldX = position.x;
    const oldZ = position.z;
    const next = pointOnPath(this.travelPath, eased, this.travelLength);
    position.x = next.x;
    position.z = next.z;
    this.world.vehicle.speed =
      dt > 0 ? Math.hypot(position.x - oldX, position.z - oldZ) / dt : 0;
    if (this.world.vehicle.speed > 0.01) {
      const heading = Math.atan2(position.x - oldX, position.z - oldZ);
      const delta = Math.atan2(
        Math.sin(heading - this.world.vehicle.heading),
        Math.cos(heading - this.world.vehicle.heading),
      );
      this.world.vehicle.heading += delta * (1 - Math.exp(-dt * 7));
    }
    if (u >= 1) {
      this.world.vehicle.speed = 0;
      this.orientAtArrival(opportunity, decision);
      this.arrive(opportunity, decision);
    }
  }

  private orientAtArrival(
    opportunity: VehicleOpportunity,
    decision: VehicleDecision,
  ) {
    const actor = opportunity.actorId
      ? this.scene.actors.find((item) => item.id === opportunity.actorId)
      : undefined;

    if (!actor || decision.performance.facing === "travel") return;

    const toward = normalize({
      x: actor.position.x - this.world.vehicle.position.x,
      z: actor.position.z - this.world.vehicle.position.z,
    });

    const direction =
      decision.performance.facing === "away"
        ? { x: -toward.x, z: -toward.z }
        : toward;

    this.world.vehicle.heading = Math.atan2(direction.x, direction.z);
  }

  private arrive(opportunity: VehicleOpportunity, decision: VehicleDecision) {
    const beat = this.currentBeat();
    const actor = opportunity.actorId
      ? this.scene.actors.find((item) => item.id === opportunity.actorId)
      : undefined;

    this.pushEvent(`arrived:${opportunity.id}`);
    this.world.interactionsInBeat += 1;

    this.hooks.onVehiclePerformance?.({
      beatId: beat.id,
      opportunity,
      actor,
      decision,
    });

    if (actor) {
      const actorState = this.world.actors[actor.id];
      actorState.attention = 1;
      this.pendingActor = true;
      const generation = this.generation;
      void this.requestActorReaction(actor, opportunity, decision)
        .catch((error) => {
          if (generation === this.generation) this.hooks.onError?.(error);
        })
        .finally(() => {
          if (generation === this.generation) this.pendingActor = false;
        });
    }

    this.world.vehicle.currentOpportunityId = undefined;
    this.dwellRemaining = Math.max(0.15, decision.performance.dwell);
  }

  private async requestActorReaction(
    actor: ActorDefinition,
    opportunity: VehicleOpportunity,
    vehicleDecision: VehicleDecision,
  ) {
    const generation = this.generation;
    const beat = this.currentBeat();

    const decision = await this.policy.chooseActor({
      scene: this.scene,
      world: structuredClone(this.world),
      beat,
      personality: this.world.vehicle.personality,
      actor,
      stimulus: {
        vehicleAction: opportunity.action,
        vehiclePerformance: vehicleDecision.performance,
      },
      availableCapabilities: actor.capabilities,
    });

    if (generation !== this.generation || !decision) return;

    if (
      !actor.capabilities.some(
        (capability) => capability.id === decision.capabilityId,
      )
    ) {
      throw new Error(
        `Policy selected unavailable capability "${decision.capabilityId}" for actor "${actor.id}"`,
      );
    }

    this.world.actors[actor.id].performance = {
      capabilityId: decision.capabilityId,
      intensity: decision.intensity,
      duration: decision.duration,
      delay: decision.delay,
    };

    this.pushEvent(
      `actor:${actor.id}:${decision.capabilityId}:intensity=${decision.intensity.toFixed(2)}`,
    );

    const stageDuration = await this.hooks.onActorPerformance?.({
      beatId: beat.id,
      actor,
      decision,
    });
    if (generation !== this.generation) return;
    this.dwellRemaining = Math.max(
      this.dwellRemaining,
      decision.delay + decision.duration + 0.35,
      stageDuration ?? 0,
    );
  }

  private finishInteraction() {
    this.activeOpportunity = undefined;
    this.activeDecision = undefined;
    this.world.vehicle.performance = undefined;

    const beat = this.currentBeat();
    const satisfied =
      this.world.interactionsInBeat >= beat.completion.minInteractions;

    if (!satisfied) {
      return;
    }

    if (!beat.nextBeatId) {
      this.world.completed = true;
      this.world.vehicle.speed = 0;
      this.pushEvent("scene:complete");
      this.hooks.onComplete?.();
      return;
    }

    this.world.beatId = beat.nextBeatId;
    this.world.interactionsInBeat = 0;
    this.pushEvent(`beat:${beat.nextBeatId}`);
    this.hooks.onBeatChanged?.(this.currentBeat());
  }

  private pushEvent(event: string) {
    this.world.recentEvents.push(event);
    this.world.recentEvents = this.world.recentEvents.slice(-16);
  }
}
