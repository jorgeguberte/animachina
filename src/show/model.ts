import type {
  ActorPerformanceEvent,
  BeatDefinition,
  PersonalityProfile,
  SceneDefinition,
  WorldState,
} from "../engine/model";

export type ShowCapability = {
  id: string;
  label: string;
  description: string;
};

export type ShowSpec = {
  lightCapabilities: ShowCapability[];
  soundCapabilities: ShowCapability[];
  setMotionCapabilities: ShowCapability[];
};

export type StagePolicyContext = {
  scene: SceneDefinition;
  world: Readonly<WorldState>;
  beat: BeatDefinition;
  personality: PersonalityProfile;
  moment: ActorPerformanceEvent;
  show: ShowSpec;
};

export type StageDecision = {
  lightCueId: string;
  soundCueId: string;
  setMotionCueId: string;
  energy: number;
  anticipation: number;
  sustain: number;
  confidence: number;
  source: "local" | "jev";
};

export type StageDecisionEvent = {
  moment: ActorPerformanceEvent;
  decision: StageDecision;
};
