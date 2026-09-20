import type {
  ActorDecision,
  ActorPolicyContext,
  VehicleDecision,
  VehiclePolicyContext,
} from "./model";

export interface DecisionPolicy {
  chooseVehicle(context: VehiclePolicyContext): Promise<VehicleDecision>;
  chooseActor(context: ActorPolicyContext): Promise<ActorDecision | null>;
}

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * Fallback policy used only to exercise the runtime before Jev is connected.
 *
 * Deliberately personality-blind.
 *
 * If "glamorous", "shy", or any other semantic profile causes meaningful
 * behavior here, we have accidentally hardcoded intelligence into Animachina.
 * This policy therefore picks from capabilities and performance parameters
 * without understanding what they mean.
 */
export class LocalPolicy implements DecisionPolicy {
  async chooseVehicle(context: VehiclePolicyContext): Promise<VehicleDecision> {
    const selected =
      context.opportunities[
        Math.floor(Math.random() * context.opportunities.length)
      ];

    if (!selected) {
      throw new Error(`No opportunities available for beat ${context.beat.id}`);
    }

    return {
      opportunityId: selected.id,
      performance: {
        speed: randomBetween(1.25, 2.9),
        curvature: randomBetween(-0.42, 0.42),
        hesitation: randomBetween(0, 0.9),
        dwell: randomBetween(0.55, 1.8),
        facing: ["travel", "target", "away"][
          Math.floor(Math.random() * 3)
        ] as "travel" | "target" | "away",
      },
      confidence: 0,
      source: "local",
    };
  }

  async chooseActor(context: ActorPolicyContext): Promise<ActorDecision | null> {
    const capability =
      context.availableCapabilities[
        Math.floor(Math.random() * context.availableCapabilities.length)
      ];

    if (!capability) return null;

    return {
      actorId: context.actor.id,
      capabilityId: capability.id,
      intensity: randomBetween(0.25, 1),
      duration: randomBetween(0.7, 2.2),
      delay: randomBetween(0, 0.45),
      confidence: 0,
      source: "local",
    };
  }
}

/**
 * Jev belongs here.
 *
 * Jev should receive compact semantic context:
 * - creative intent + active beat
 * - personality description
 * - current world state / recent events
 * - the concrete opportunities or capabilities that actually exist
 *
 * It chooses intent and performance parameters. It never invents geometry,
 * drives coordinates frame-by-frame, or bypasses a performer's capabilities.
 */
export class JevPolicy implements DecisionPolicy {
  async chooseVehicle(
    _context: VehiclePolicyContext,
  ): Promise<VehicleDecision> {
    throw new Error(
      "JevPolicy is not wired yet. Pin the real Jev API before implementing this adapter.",
    );
  }

  async chooseActor(
    _context: ActorPolicyContext,
  ): Promise<ActorDecision | null> {
    throw new Error(
      "JevPolicy is not wired yet. Pin the real Jev API before implementing this adapter.",
    );
  }
}
