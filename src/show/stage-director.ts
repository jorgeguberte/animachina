import type {
  ActorPerformanceEvent,
  SceneDefinition,
  WorldState,
} from "../engine/model";
import type { StagePolicy } from "./policy";
import type {
  ShowSpec,
  StageDecisionEvent,
  StagePolicyContext,
} from "./model";

type StageDirectorHooks = {
  onDecision?: (event: StageDecisionEvent) => void;
};

export class StageDirector {
  private generation = 0;

  constructor(
    private readonly show: ShowSpec,
    private readonly policy: StagePolicy,
    private readonly hooks: StageDirectorHooks = {},
  ) {}

  reset() {
    this.generation += 1;
  }

  async direct(
    scene: SceneDefinition,
    world: Readonly<WorldState>,
    moment: ActorPerformanceEvent,
  ) {
    const generation = this.generation;
    const beat = scene.beats.find(
      (candidate) => candidate.id === moment.beatId,
    );

    if (!beat) {
      throw new Error(`Unknown stage beat: ${moment.beatId}`);
    }

    const context: StagePolicyContext = {
      scene,
      world,
      beat,
      personality: world.vehicle.personality,
      moment,
      show: this.show,
    };

    const decision = await this.policy.direct(context);

    if (generation !== this.generation) return;

    this.hooks.onDecision?.({
      moment,
      decision,
    });
  }
}
