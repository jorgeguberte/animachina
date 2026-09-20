import type {
  Affordance,
  Personality,
  PolicyContext,
  PolicyDecision,
  PerformanceStyle,
} from "./model";

export interface DecisionPolicy {
  choose(context: PolicyContext): Promise<PolicyDecision>;
}

const PERSONALITY_TAGS: Record<Personality, string[]> = {
  glamorous: ["center-stage", "spectacle", "social", "dramatic"],
  shy: ["quiet", "peripheral", "gentle", "low-attention"],
  chaotic: ["odd", "risky", "interactive", "surprising"],
};

const PERSONALITY_STYLE: Record<Personality, PerformanceStyle> = {
  glamorous: "showy",
  shy: "careful",
  chaotic: "impulsive",
};

function scoreAffordance(
  affordance: Affordance,
  personality: Personality,
): number {
  const desired = PERSONALITY_TAGS[personality];
  const matches = affordance.tags.filter((tag) => desired.includes(tag)).length;

  // Stable tie-breaker so the local policy is reproducible.
  const lexicalBias =
    affordance.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    17;

  return matches * 100 + lexicalBias;
}

/**
 * Temporary deterministic policy.
 *
 * This is intentionally boring. Its only job is to prove that Animachina's
 * runtime does not care who makes the decision. A Jev adapter will implement
 * the same DecisionPolicy interface and replace this without touching Scene,
 * Vehicle, Actor, Beat or rendering code.
 */
export class LocalPolicy implements DecisionPolicy {
  async choose(context: PolicyContext): Promise<PolicyDecision> {
    const personality = context.world.vehicle.personality;

    const ranked = [...context.availableAffordances].sort(
      (a, b) =>
        scoreAffordance(b, personality) - scoreAffordance(a, personality),
    );

    const selected = ranked[0];

    if (!selected) {
      throw new Error(`No affordances available for beat ${context.beat.id}`);
    }

    return {
      affordanceId: selected.id,
      style: PERSONALITY_STYLE[personality] ?? "neutral",
      confidence: 1,
      source: "local",
    };
  }
}

/**
 * Jev belongs here.
 *
 * The adapter should:
 * 1. receive PolicyContext,
 * 2. serialize only the compact semantic state Jev needs,
 * 3. ask Jev to choose among the supplied affordance IDs,
 * 4. return a PolicyDecision.
 *
 * Do not let Jev steer coordinates or animation frames. It chooses intent;
 * deterministic systems execute it.
 */
export class JevPolicy implements DecisionPolicy {
  async choose(_context: PolicyContext): Promise<PolicyDecision> {
    throw new Error(
      "JevPolicy is not wired yet. Add the TypeSafe/Jev client here once the API contract is pinned.",
    );
  }
}
