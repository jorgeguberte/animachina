import type { StagePolicy } from "./policy";
import type {
  ShowCapability,
  StageDecision,
  StagePolicyContext,
} from "./model";

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

const ENERGY = [0.16, 0.36, 0.6, 0.82, 1] as const;
const ANTICIPATION = [0, 0.12, 0.32, 0.65] as const;
const SUSTAIN = [0.45, 0.9, 1.5, 2.4] as const;

function interpolate(score: number, values: readonly number[]) {
  const clamped = Math.max(0, Math.min(values.length - 1, score));
  const low = Math.floor(clamped);
  const high = Math.ceil(clamped);

  if (low === high) return values[low];

  const mix = clamped - low;
  return values[low] * (1 - mix) + values[high] * mix;
}

function sampleDistribution(
  probabilities: Record<string, number>,
  options: readonly string[],
  temperature = 1.18,
  exploration = 0.08,
) {
  if (options.length === 0) {
    throw new Error("Cannot sample an empty stage distribution.");
  }

  const inverseTemperature = 1 / Math.max(0.05, temperature);
  const uniform = 1 / options.length;

  const raw = options.map((option) =>
    Math.pow(Math.max(0, probabilities[option] ?? 0) + 1e-9, inverseTemperature),
  );

  const totalRaw = raw.reduce((sum, value) => sum + value, 0);
  const weights = raw.map((value) => {
    const semantic = totalRaw > 0 ? value / totalRaw : uniform;
    return semantic * (1 - exploration) + uniform * exploration;
  });

  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = Math.random() * total;

  for (let index = 0; index < options.length; index += 1) {
    cursor -= weights[index];

    if (cursor <= 0) return options[index];
  }

  return options[options.length - 1];
}

function sampleScore(answer: ScoreAnswer, blend = 0.28) {
  const keys = Object.keys(answer.probabilities).sort(
    (a, b) => Number(a) - Number(b),
  );

  const sampled = Number(
    sampleDistribution(answer.probabilities, keys, 1.08, 0.03),
  );

  if (!Number.isFinite(sampled)) return answer.score;

  return answer.score * (1 - blend) + sampled * blend;
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

function capabilityCriteria(capabilities: ShowCapability[]) {
  return Object.fromEntries(
    capabilities.map((capability) => [
      capability.id,
      {
        name: capability.label,
        effect: capability.description,
      },
    ]),
  );
}

async function askSystemOne(
  state: Record<string, unknown>,
  questions: Record<string, Question>,
): Promise<SystemOneResponse> {
  const response = await fetch("/api/system-one", {
    method: "POST",
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

/**
 * Jev directs the supporting stagecraft after an actor has made a choice.
 *
 * The stage never invents a new story beat. It answers a narrower question:
 * "How should light, sound and scenic machinery support this moment?"
 */
export class JevStagePolicy implements StagePolicy {
  constructor(private readonly fallback?: StagePolicy) {}

  async direct(context: StagePolicyContext): Promise<StageDecision> {
    try {
      return await this.directWithJev(context);
    } catch (error) {
      if (!this.fallback) throw error;

      console.warn(
        "[Animachina] Jev stage direction failed; using fallback.",
        error,
      );

      return this.fallback.direct(context);
    }
  }

  private async directWithJev(
    context: StagePolicyContext,
  ): Promise<StageDecision> {
    const actorDecision = context.moment.decision;
    const state = {
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
      current_moment: {
        performer: context.moment.actor.id,
        performer_kind: context.moment.actor.kind,
        performer_character: context.moment.actor.tags.join(", "),
        actor_action: actorDecision.capabilityId,
        actor_intensity: actorDecision.intensity.toFixed(2),
        actor_duration_seconds: actorDecision.duration.toFixed(2),
        actor_delay_seconds: actorDecision.delay.toFixed(2),
      },
      recent_events:
        context.world.recentEvents.length > 0
          ? context.world.recentEvents
          : ["The scene has just begun."],
      direction_task:
        "Support the moment that is already happening. Do not invent a new plot event. Use stagecraft to focus attention, reinforce or contrast the emotional beat, and preserve room for the performers.",
    };

    const response = await askSystemOne(state, {
      lighting: {
        type: "choice",
        instructions:
          "Which available lighting capability best supports this exact performance moment?",
        criteria: capabilityCriteria(context.show.lightCapabilities),
      },
      sound: {
        type: "choice",
        instructions:
          "Which available sound capability best supports this exact performance moment?",
        criteria: capabilityCriteria(context.show.soundCapabilities),
      },
      set_motion: {
        type: "choice",
        instructions:
          "Which available scenic-motion capability best supports this exact performance moment without stealing focus?",
        criteria: capabilityCriteria(context.show.setMotionCapabilities),
      },
      stage_energy: {
        type: "score",
        instructions:
          "How much overall stagecraft energy should support this moment?",
        criteria: [
          "Almost invisible support. Preserve stillness and intimacy.",
          "Subtle support. The audience should feel it more than notice it.",
          "Clear theatrical support. Lighting/sound/machinery may visibly punctuate the action.",
          "Strong show moment. The environment clearly joins the performance.",
          "Full spectacle. Use the stage boldly because this moment warrants becoming a centerpiece.",
        ],
      },
      anticipation: {
        type: "score",
        instructions:
          "How much anticipatory delay should happen before the supporting stage cues arrive?",
        criteria: [
          "Immediate. The stage responds with the performer.",
          "Tiny beat. A quick breath before the stage answers.",
          "Noticeable anticipation. Let the actor land first, then support it.",
          "Suspenseful delay. Hold the environment back before the response.",
        ],
      },
      sustain: {
        type: "score",
        instructions:
          "How long should the stagecraft hold this moment before relaxing?",
        criteria: [
          "Very brief accent.",
          "Short readable punctuation.",
          "Sustained theatrical beat.",
          "Long lingering tableau.",
        ],
      },
    });

    const lighting = response.answers.lighting as ChoiceAnswer;
    const sound = response.answers.sound as ChoiceAnswer;
    const setMotion = response.answers.set_motion as ChoiceAnswer;
    const energy = response.answers.stage_energy as ScoreAnswer;
    const anticipation = response.answers.anticipation as ScoreAnswer;
    const sustain = response.answers.sustain as ScoreAnswer;

    const lightCueId = sampleDistribution(
      lighting.probabilities,
      context.show.lightCapabilities.map((capability) => capability.id),
      1.12,
      0.06,
    );

    const soundCueId = sampleDistribution(
      sound.probabilities,
      context.show.soundCapabilities.map((capability) => capability.id),
      1.16,
      0.08,
    );

    const setMotionCueId = sampleDistribution(
      setMotion.probabilities,
      context.show.setMotionCapabilities.map((capability) => capability.id),
      1.2,
      0.1,
    );

    console.debug("[Animachina] stage distribution", {
      actor: context.moment.actor.id,
      lighting: {
        argmax: lighting.choice,
        sampled: lightCueId,
        probabilities: lighting.probabilities,
      },
      sound: {
        argmax: sound.choice,
        sampled: soundCueId,
        probabilities: sound.probabilities,
      },
      setMotion: {
        argmax: setMotion.choice,
        sampled: setMotionCueId,
        probabilities: setMotion.probabilities,
      },
    });

    return {
      lightCueId,
      soundCueId,
      setMotionCueId,
      energy: interpolate(sampleScore(energy), ENERGY),
      anticipation: interpolate(
        sampleScore(anticipation, 0.22),
        ANTICIPATION,
      ),
      sustain: interpolate(sampleScore(sustain, 0.22), SUSTAIN),
      confidence: averageConfidence([
        lighting,
        sound,
        setMotion,
        energy,
        anticipation,
        sustain,
      ]),
      source: "jev",
    };
  }
}
