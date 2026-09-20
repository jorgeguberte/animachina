export type Vec2 = {
  x: number;
  z: number;
};

export type PersonalityProfile = {
  id: string;
  label: string;
  description: string;
};

export type VehicleAction =
  | "approach"
  | "observe"
  | "orbit"
  | "linger"
  | "exit";

export type FacingMode = "travel" | "target" | "away";

export type ActorCapabilityDefinition = {
  id: string;
  label: string;
  description: string;
};

export type ActorDefinition = {
  id: string;
  kind: "fountain" | "statue" | "flowers" | "lamp" | "creature";
  position: Vec2;
  tags: string[];
  interactionRadius: number;
  capabilities: ActorCapabilityDefinition[];
};

export type VehicleOpportunity = {
  id: string;
  action: VehicleAction;
  target: Vec2;
  actorId?: string;
  description: string;
  tags: string[];
};

export type BeatDefinition = {
  id: string;
  intent: string;
  availableActions: VehicleAction[];
  completion: {
    minInteractions: number;
  };
  nextBeatId?: string;
};

export type SceneDefinition = {
  id: string;
  name: string;
  creativeIntent: string;
  bounds: {
    min: Vec2;
    max: Vec2;
  };
  entry: Vec2;
  exit: Vec2;
  actors: ActorDefinition[];
  beats: BeatDefinition[];
  firstBeatId: string;
};

export type VehiclePerformance = {
  speed: number;
  curvature: number;
  hesitation: number;
  dwell: number;
  facing: FacingMode;
};

export type VehicleState = {
  position: Vec2;
  heading: number;
  speed: number;
  personality: PersonalityProfile;
  currentOpportunityId?: string;
  performance?: VehiclePerformance;
};

export type ActorPerformance = {
  capabilityId: string;
  intensity: number;
  duration: number;
  delay: number;
};

export type ActorState = {
  id: string;
  attention: number;
  performance?: ActorPerformance;
};

export type WorldState = {
  sceneId: string;
  elapsed: number;
  beatId: string;
  interactionsInBeat: number;
  vehicle: VehicleState;
  actors: Record<string, ActorState>;
  recentEvents: string[];
  completed: boolean;
};

export type VehiclePolicyContext = {
  scene: SceneDefinition;
  world: Readonly<WorldState>;
  beat: BeatDefinition;
  personality: PersonalityProfile;
  opportunities: readonly VehicleOpportunity[];
};

export type ActorPolicyContext = {
  scene: SceneDefinition;
  world: Readonly<WorldState>;
  beat: BeatDefinition;
  personality: PersonalityProfile;
  actor: ActorDefinition;
  stimulus: {
    vehicleAction: VehicleAction;
    vehiclePerformance: VehiclePerformance;
  };
  availableCapabilities: readonly ActorCapabilityDefinition[];
};

export type VehicleDecision = {
  opportunityId: string;
  performance: VehiclePerformance;
  confidence: number;
  source: "local" | "jev";
};

export type ActorDecision = {
  actorId: string;
  capabilityId: string;
  intensity: number;
  duration: number;
  delay: number;
  confidence: number;
  source: "local" | "jev";
};

export type VehiclePerformanceEvent = {
  beatId: string;
  opportunity: VehicleOpportunity;
  actor?: ActorDefinition;
  decision: VehicleDecision;
};

export type ActorPerformanceEvent = {
  beatId: string;
  actor: ActorDefinition;
  decision: ActorDecision;
};
