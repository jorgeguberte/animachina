import type {
  ActorDecision,
  ActorPolicyContext,
  VehicleDecision,
  VehicleOpportunity,
  VehiclePolicyContext,
} from "./model";
import type { DecisionPolicy } from "./policy";

type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
};

type SystemOneResponse = {
  model: string;
  answers: Record<string, ChoiceAnswer | ScoreAnswer>;
};

type Question =
  | {
      type: "choice";
      instructions: string | Record<string, unknown>;
      criteria: Record<string, string | Record<string, unknown> | null>;
    }
  | {
      type: "score";
      instructions: string | Record<string, unknown>;
      criteria: Array<string | Record<string, unknown>>;
    };

const round = (value: number) => Math.round(value * 100) / 100;

type SamplingOptions = {
  temperature?: number;
  exploration?: number;
  multipliers?: Record<string, number>;
};

function sampleDistribution(
  probabilities: Record<string, number>,
  options: readonly string[],
  { temperature = 1, exploration = 0, multipliers = {} }: SamplingOptions = {},
): string {
  if (options.length === 0) {
    throw new Error("Cannot sample an empty distribution.");
  }

  const inverseTemperature = 1 / Math.max(0.05, temperature);
  const uniform = 1 / options.length;

  const tempered = options.map((option) => {
    const probability = Math.max(0, probabilities[option] ?? 0);
    return Math.pow(probability + 1e-9, inverseTemperature);
  });

  const temperedTotal = tempered.reduce((sum, value) => sum + value, 0);

  const weights = options.map((option, index) => {
    const semanticWeight =
      temperedTotal > 0 ? tempered[index] / temperedTotal : uniform;

    // Exploration is generic entropy, not personality logic. It keeps a
    // calibrated distribution from collapsing into the same argmax forever.
    const mixed = semanticWeight * (1 - exploration) + uniform * exploration;

    return mixed * Math.max(0, multipliers[option] ?? 1);
  });

  const total = weights.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return options[Math.floor(Math.random() * options.length)];
  }

  let cursor = Math.random() * total;

  for (let index = 0; index < options.length; index += 1) {
    cursor -= weights[index];

    if (cursor <= 0) {
      return options[index];
    }
  }

  return options[options.length - 1];
}

function sampleScore(
  answer: ScoreAnswer,
  blend = 0.35,
  temperature = 1.08,
): number {
  const keys = Object.keys(answer.probabilities).sort(
    (a, b) => Number(a) - Number(b),
  );

  const sampledKey = sampleDistribution(answer.probabilities, keys, {
    temperature,
    exploration: 0.04,
  });

  const sampled = Number(sampledKey);

  if (!Number.isFinite(sampled)) return answer.score;

  // Keep Jev's expected score as the anchor, but let its own probability
  // distribution create performance variation around that semantic center.
  return answer.score * (1 - blend) + sampled * blend;
}

function opportunityNoveltyMultipliers(
  context: VehiclePolicyContext,
): Record<string, number> {
  const recent = context.world.recentEvents.join("|");

  return Object.fromEntries(
    context.opportunities.map((opportunity) => {
      let multiplier = 1;

      if (recent.includes(opportunity.id)) {
        multiplier *= 0.18;
      }

      if (opportunity.actorId && recent.includes(`:${opportunity.actorId}`)) {
        multiplier *= 0.48;
      }

      if (recent.includes(`:${opportunity.action}:`)) {
        multiplier *= 0.78;
      }

      return [opportunity.id, multiplier];
    }),
  );
}

function capabilityNoveltyMultipliers(
  context: ActorPolicyContext,
): Record<string, number> {
  const recent = context.world.recentEvents.join("|");

  return Object.fromEntries(
    context.availableCapabilities.map((capability) => [
      capability.id,
      recent.includes(`:${capability.id}:`) ? 0.38 : 1,
    ]),
  );
}

function interpolate(score: number, values: readonly number[]) {
  const clamped = Math.max(0, Math.min(values.length - 1, score));
  const low = Math.floor(clamped);
  const high = Math.ceil(clamped);

  if (low === high) return values[low];

  const mix = clamped - low;
  return values[low] * (1 - mix) + values[high] * mix;
}

function averageConfidence(
  answers: Array<ChoiceAnswer | ScoreAnswer | undefined>,
) {
  const values = answers
    .map((answer) => answer?.confidence)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactWorld(context: VehiclePolicyContext | ActorPolicyContext) {
  return {
    scene: {
      name: context.scene.name,
      creative_intent: context.scene.creativeIntent,
    },
    beat: {
      id: context.beat.id,
      dramatic_intent: context.beat.intent,
    },
    guest_vehicle_profile: {
      label: context.personality.label,
      description: context.personality.description,
    },
    pacing: {
      interactions_in_beat: context.world.interactionsInBeat,
      minimum_interactions: context.beat.completion.minInteractions,
      elapsed_seconds: Math.round(context.world.elapsed),
      direction:
        "Build a readable emotional arc. Let recent events matter; balance novelty with callbacks. Stillness is a valid performance choice.",
    },
    current_vehicle: {
      position: `${round(context.world.vehicle.position.x)}, ${round(
        context.world.vehicle.position.z,
      )}`,
      heading_radians: String(round(context.world.vehicle.heading)),
      current_speed: String(round(context.world.vehicle.speed)),
    },
    scene_performers: context.scene.actors.map((actor) => ({
      id: actor.id,
      kind: actor.kind,
      position: `${actor.position.x}, ${actor.position.z}`,
      character: actor.tags.join(", "),
    })),
    recent_events:
      context.world.recentEvents.length > 0
        ? context.world.recentEvents
        : ["The scene has just begun."],
  };
}

async function askSystemOne(
  state: Record<string, unknown>,
  questions: Record<string, Question>,
): Promise<SystemOneResponse> {
  const response = await fetch("/api/system-one", {
    method: "POST",
    signal: AbortSignal.timeout(3500),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state,
      questions,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `TypeSafe request failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  return (await response.json()) as SystemOneResponse;
}

const SPEED_VALUES = [0.8, 1.3, 1.85, 2.4, 2.95] as const;
const CURVATURE_VALUES = [0, 0.14, 0.29, 0.46] as const;
const HESITATION_VALUES = [0, 0.2, 0.65, 1.2] as const;
const DWELL_VALUES = [0.3, 0.75, 1.35, 2.1] as const;

const INTENSITY_VALUES = [0.2, 0.45, 0.75, 1] as const;
const DURATION_VALUES = [0.45, 0.9, 1.5, 2.3] as const;
const DELAY_VALUES = [0, 0.12, 0.35, 0.7] as const;

/**
 * Real System One policy for Animachina.
 *
 * Each performer is decided in two stages:
 * 1. What should happen?
 * 2. Given that choice, how should it be performed?
 *
 * This mirrors Jev's strength: small, atomic judgments over structured state.
 */
export class JevPolicy implements DecisionPolicy {
  constructor(private readonly fallback?: DecisionPolicy) {}

  async chooseVehicle(context: VehiclePolicyContext): Promise<VehicleDecision> {
    try {
      return await this.chooseVehicleWithJev(context);
    } catch (error) {
      if (!this.fallback) throw error;

      console.warn(
        "[Animachina] Jev vehicle decision failed; using fallback.",
        error,
      );
      return this.fallback.chooseVehicle(context);
    }
  }

  async chooseActor(
    context: ActorPolicyContext,
  ): Promise<ActorDecision | null> {
    try {
      return await this.chooseActorWithJev(context);
    } catch (error) {
      if (!this.fallback) throw error;

      console.warn(
        "[Animachina] Jev actor decision failed; using fallback.",
        error,
      );
      return this.fallback.chooseActor(context);
    }
  }

  private async chooseVehicleWithJev(
    context: VehiclePolicyContext,
  ): Promise<VehicleDecision> {
    const opportunityCriteria = Object.fromEntries(
      context.opportunities.map((opportunity) => [
        opportunity.id,
        {
          action: opportunity.action,
          performer: opportunity.actorId ?? "scene exit",
          meaning: opportunity.description,
          qualities: opportunity.tags.join(", "),
        },
      ]),
    );

    const choiceResponse = await askSystemOne(compactWorld(context), {
      next_opportunity: {
        type: "choice",
        instructions:
          "Which available opportunity would this vehicle most naturally choose next? Judge from the guest/vehicle personality, current dramatic intent, scene state, performers and recent events. Choose the action that best continues this performance now.",
        criteria: opportunityCriteria,
      },
    });

    const opportunityAnswer = choiceResponse.answers
      .next_opportunity as ChoiceAnswer;

    const sampledOpportunityId = sampleDistribution(
      opportunityAnswer.probabilities,
      context.opportunities.map((opportunity) => opportunity.id),
      {
        temperature: 1.18,
        exploration: 0.1,
        multipliers: opportunityNoveltyMultipliers(context),
      },
    );

    const selected = context.opportunities.find(
      (opportunity) => opportunity.id === sampledOpportunityId,
    );

    if (!selected) {
      throw new Error(
        `Could not resolve sampled vehicle opportunity "${sampledOpportunityId}".`,
      );
    }

    console.debug("[Animachina] vehicle distribution", {
      profile: context.personality.id,
      argmax: opportunityAnswer.choice,
      sampled: selected.id,
      probabilities: opportunityAnswer.probabilities,
    });

    const performanceState = {
      ...compactWorld(context),
      selected_opportunity: {
        id: selected.id,
        action: selected.action,
        performer: selected.actorId ?? "scene exit",
        meaning: selected.description,
        qualities: selected.tags.join(", "),
      },
      task: "Decide how the vehicle should physically perform the already-selected opportunity. Each question measures one independent performance dimension.",
    };

    const performanceResponse = await askSystemOne(performanceState, {
      movement_energy: {
        type: "score",
        instructions:
          "How energetically should the vehicle move while performing the selected opportunity?",
        criteria: [
          "Almost still: extremely restrained movement, barely committing.",
          "Slow and deliberate: clearly moving, but gently and carefully.",
          "Natural ride pace: composed, readable movement without emphasis.",
          "Brisk and expressive: obvious energy and purposeful motion.",
          "Fast and emphatic: a strong entrance or highly energetic commitment.",
        ],
      },
      path_curvature: {
        type: "score",
        instructions:
          "How curved or indirect should the vehicle's path feel as expressive body language?",
        criteria: [
          "Direct: take the cleanest practical line with no flourish.",
          "Gentle arc: a small amount of expressive curvature.",
          "Pronounced curve: clearly indirect, with visible body language.",
          "Sweeping flourish: strongly curved, theatrical movement.",
        ],
      },
      curve_side: {
        type: "choice",
        instructions:
          "If the path curves, which direction should the expressive arc favor?",
        criteria: {
          straight:
            "No meaningful side preference; keep the path essentially direct.",
          left: "Favor an expressive arc to the vehicle's left.",
          right: "Favor an expressive arc to the vehicle's right.",
        },
      },
      hesitation: {
        type: "score",
        instructions:
          "How much should the vehicle hesitate before committing to the selected opportunity?",
        criteria: [
          "Immediate: commit with no perceptible pause.",
          "Tiny beat: a brief moment of anticipation.",
          "Noticeable hesitation: pause long enough to read as a choice.",
          "Strong hesitation: hold for suspense before moving.",
        ],
      },
      dwell: {
        type: "score",
        instructions:
          "Once it reaches the selected opportunity, how long should the vehicle hold the moment before the next decision?",
        criteria: [
          "Touch-and-go: only enough time to register arrival.",
          "Brief beat: a short readable pause.",
          "Sustained beat: remain long enough for a clear exchange.",
          "Lingering beat: deliberately hold the moment for dramatic effect.",
        ],
      },
      facing: {
        type: "choice",
        instructions:
          "At the end of this move, what should the vehicle's body language face?",
        criteria: {
          travel: "Keep facing along its direction of travel.",
          target: "Turn to acknowledge the performer or destination it chose.",
          away: "Turn conspicuously away from the performer as part of the performance.",
        },
      },
    });

    const speed = performanceResponse.answers.movement_energy as ScoreAnswer;
    const curvature = performanceResponse.answers.path_curvature as ScoreAnswer;
    const curveSide = performanceResponse.answers.curve_side as ChoiceAnswer;
    const hesitation = performanceResponse.answers.hesitation as ScoreAnswer;
    const dwell = performanceResponse.answers.dwell as ScoreAnswer;
    const facing = performanceResponse.answers.facing as ChoiceAnswer;

    const sampledCurveSide = sampleDistribution(
      curveSide.probabilities,
      ["straight", "left", "right"],
      { temperature: 1.16, exploration: 0.06 },
    );

    const sampledFacing = sampleDistribution(
      facing.probabilities,
      ["travel", "target", "away"],
      { temperature: 1.12, exploration: 0.04 },
    );

    const magnitude = interpolate(sampleScore(curvature), CURVATURE_VALUES);

    const signedCurvature =
      sampledCurveSide === "straight"
        ? 0
        : magnitude * (sampledCurveSide === "left" ? -1 : 1);

    const facingValue =
      sampledFacing === "target" || sampledFacing === "away"
        ? sampledFacing
        : "travel";

    return {
      opportunityId: selected.id,
      performance: {
        speed: interpolate(sampleScore(speed), SPEED_VALUES),
        curvature: signedCurvature,
        hesitation: interpolate(
          sampleScore(hesitation, 0.3),
          HESITATION_VALUES,
        ),
        dwell: interpolate(sampleScore(dwell, 0.3), DWELL_VALUES),
        facing: facingValue,
      },
      confidence: averageConfidence([
        opportunityAnswer,
        speed,
        curvature,
        curveSide,
        hesitation,
        dwell,
        facing,
      ]),
      source: "jev",
    };
  }

  private async chooseActorWithJev(
    context: ActorPolicyContext,
  ): Promise<ActorDecision | null> {
    if (context.availableCapabilities.length === 0) return null;

    const baseState = {
      ...compactWorld(context),
      reacting_performer: {
        id: context.actor.id,
        kind: context.actor.kind,
        character: context.actor.tags.join(", "),
      },
      stimulus: {
        vehicle_action: context.stimulus.vehicleAction,
        vehicle_speed: String(round(context.stimulus.vehiclePerformance.speed)),
        vehicle_curvature: String(
          round(context.stimulus.vehiclePerformance.curvature),
        ),
        vehicle_hesitation_seconds: String(
          round(context.stimulus.vehiclePerformance.hesitation),
        ),
        vehicle_facing: context.stimulus.vehiclePerformance.facing,
      },
    };

    const capabilityResponse = await askSystemOne(baseState, {
      reaction: {
        type: "choice",
        instructions:
          "How should this performer respond right now? Choose only among its real physical capabilities. Judge the guest/vehicle personality, the vehicle's just-observed behavior, the active dramatic intent and recent events.",
        criteria: Object.fromEntries(
          context.availableCapabilities.map((capability) => [
            capability.id,
            capability.description,
          ]),
        ),
      },
    });

    const capabilityAnswer = capabilityResponse.answers
      .reaction as ChoiceAnswer;
    const sampledCapabilityId = sampleDistribution(
      capabilityAnswer.probabilities,
      context.availableCapabilities.map((capability) => capability.id),
      {
        temperature: 1.15,
        exploration: 0.08,
        multipliers: capabilityNoveltyMultipliers(context),
      },
    );

    const selectedCapability = context.availableCapabilities.find(
      (capability) => capability.id === sampledCapabilityId,
    );

    if (!selectedCapability) {
      throw new Error(
        `Could not resolve sampled capability "${sampledCapabilityId}" for actor "${context.actor.id}".`,
      );
    }

    console.debug("[Animachina] actor distribution", {
      actor: context.actor.id,
      argmax: capabilityAnswer.choice,
      sampled: selectedCapability.id,
      probabilities: capabilityAnswer.probabilities,
    });

    const performanceResponse = await askSystemOne(
      {
        ...baseState,
        selected_reaction: {
          id: selectedCapability.id,
          meaning: selectedCapability.description,
        },
        task: "Decide how the performer should execute the already-selected reaction. Each question measures one independent performance dimension.",
      },
      {
        intensity: {
          type: "score",
          instructions:
            "How strongly should the performer execute the selected reaction?",
          criteria: [
            "Subtle: easy to miss, restrained and intimate.",
            "Clear: readable without dominating the scene.",
            "Strong: emphatic and unmistakable.",
            "Maximal: the performer commits fully and becomes the scene's focus.",
          ],
        },
        duration: {
          type: "score",
          instructions: "How long should the selected reaction remain active?",
          criteria: [
            "Very brief accent.",
            "Short, readable reaction.",
            "Sustained performance beat.",
            "Long, lingering performance.",
          ],
        },
        delay: {
          type: "score",
          instructions:
            "How much anticipation should occur before the performer starts the selected reaction?",
          criteria: [
            "Immediate response.",
            "Tiny anticipatory beat.",
            "Noticeable considered pause.",
            "Long suspenseful pause.",
          ],
        },
      },
    );

    const intensity = performanceResponse.answers.intensity as ScoreAnswer;
    const duration = performanceResponse.answers.duration as ScoreAnswer;
    const delay = performanceResponse.answers.delay as ScoreAnswer;

    return {
      actorId: context.actor.id,
      capabilityId: selectedCapability.id,
      intensity: interpolate(sampleScore(intensity, 0.32), INTENSITY_VALUES),
      duration: interpolate(sampleScore(duration, 0.28), DURATION_VALUES),
      delay: interpolate(sampleScore(delay, 0.28), DELAY_VALUES),
      confidence: averageConfidence([
        capabilityAnswer,
        intensity,
        duration,
        delay,
      ]),
      source: "jev",
    };
  }
}
