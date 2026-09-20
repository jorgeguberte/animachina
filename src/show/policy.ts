import type { StageDecision, StagePolicyContext } from "./model";

export interface StagePolicy {
  direct(context: StagePolicyContext): Promise<StageDecision>;
}

const randomItem = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];

  if (!item) {
    throw new Error("Cannot choose from an empty show capability list.");
  }

  return item;
};

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * Personality-blind fallback used only when Jev is unavailable.
 *
 * It proves that the stage machinery is independent from semantic direction.
 */
export class LocalStagePolicy implements StagePolicy {
  async direct(context: StagePolicyContext): Promise<StageDecision> {
    return {
      lightCueId: randomItem(context.show.lightCapabilities).id,
      soundCueId: randomItem(context.show.soundCapabilities).id,
      setMotionCueId: randomItem(context.show.setMotionCapabilities).id,
      energy: randomBetween(0.25, 0.9),
      anticipation: randomBetween(0, 0.45),
      sustain: randomBetween(0.8, 2.2),
      confidence: 0,
      source: "local",
    };
  }
}
