export type Vec2 = {
  x: number;
  z: number;
};

export type Personality = "glamorous" | "shy" | "chaotic";

export type PerformanceStyle =
  | "showy"
  | "careful"
  | "impulsive"
  | "neutral";

export type ActorDefinition = {
  id: string;
  kind: "fountain" | "statue" | "flowers" | "lamp" | "creature";
  position: Vec2;
  tags: string[];
};

export type Affordance = {
  id: string;
  label: string;
  action: "approach" | "observe" | "linger" | "exit";
  target: Vec2;
  actorId?: string;
  tags: string[];
};

export type BeatDefinition = {
  id: string;
  intent: string;
  affordances: Affordance[];
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

export type VehicleState = {
  position: Vec2;
  heading: number;
  speed: number;
  personality: Personality;
  currentAffordanceId?: string;
  style: PerformanceStyle;
};

export type ActorState = {
  id: string;
  attention: number;
  performance?: string;
};

export type WorldState = {
  sceneId: string;
  elapsed: number;
  beatId: string;
  vehicle: VehicleState;
  actors: Record<string, ActorState>;
  recentEvents: string[];
  completed: boolean;
};

export type PolicyContext = {
  scene: SceneDefinition;
  world: Readonly<WorldState>;
  beat: BeatDefinition;
  availableAffordances: readonly Affordance[];
};

export type PolicyDecision = {
  affordanceId: string;
  style: PerformanceStyle;
  confidence: number;
  source: "local" | "jev";
};

export type PerformanceEvent = {
  beatId: string;
  affordance: Affordance;
  actor?: ActorDefinition;
  personality: Personality;
  style: PerformanceStyle;
};
