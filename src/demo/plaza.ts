import type { PersonalityProfile, SceneDefinition } from "../engine/model";

export const demoPersonalities: PersonalityProfile[] = [
  {
    id: "wonder",
    label: "Wonder",
    description:
      "You see everything with childlike wonder. Small details captivate you; every encounter might hold a secret.",
  },
  {
    id: "dreamer",
    label: "Dreamer",
    description:
      "You are contemplative and drawn to atmosphere, lingering silences and poetic connections between things.",
  },
  {
    id: "glamorous",
    label: "Glamorous",
    description:
      "You enjoy being noticed, making an entrance, and turning an encounter into a performance.",
  },
  {
    id: "shy",
    label: "Shy",
    description:
      "You are cautious around attention, curious from a distance, and prefer gentle encounters.",
  },
  {
    id: "chaotic",
    label: "Chaotic",
    description:
      "You follow impulses, poke at unusual things, and enjoy surprising reactions.",
  },
];

export const plazaScene: SceneDefinition = {
  id: "moonlit-plaza",
  name: "Moonlit Plaza",
  creativeIntent:
    "Make the guest feel that the same place notices and performs differently for who they are.",
  bounds: {
    min: { x: -8, z: -5 },
    max: { x: 8, z: 5 },
  },
  entry: { x: -7.2, z: 0 },
  exit: { x: 7.2, z: 0 },
  actors: [
    {
      id: "lantern",
      kind: "lamp",
      position: { x: -3.3, z: -2.1 },
      interactionRadius: 0.95,
      tags: ["guiding", "warm", "mysterious", "patient"],
      capabilities: [
        {
          id: "beckon",
          label: "Beckon",
          description:
            "Lean and sway gently, as if inviting the visitor closer.",
        },
        {
          id: "glimmer",
          label: "Glimmer",
          description:
            "Let the lantern softly swell and contract like a secret signal.",
        },
        {
          id: "bow",
          label: "Bow",
          description: "Offer a slow, courteous bow of light.",
        },
      ],
    },
    {
      id: "fountain",
      kind: "fountain",
      position: { x: 0, z: 0 },
      interactionRadius: 1.25,
      tags: ["center-stage", "spectacle", "social", "dramatic"],
      capabilities: [
        {
          id: "pulse",
          label: "Pulse",
          description:
            "Raise and lower the water in a rhythmic acknowledgement.",
        },
        {
          id: "burst",
          label: "Burst",
          description: "Answer with a sudden, theatrical burst of water.",
        },
        {
          id: "dim",
          label: "Dim",
          description: "Quiet the water and become deliberately understated.",
        },
      ],
    },
    {
      id: "statue",
      kind: "statue",
      position: { x: 2.7, z: -2.1 },
      interactionRadius: 1.05,
      tags: ["formal", "watchful", "peculiar", "dramatic"],
      capabilities: [
        {
          id: "turn-toward",
          label: "Turn toward",
          description: "Slowly turn to acknowledge the vehicle.",
        },
        {
          id: "turn-away",
          label: "Turn away",
          description:
            "Notice the vehicle, then conspicuously refuse eye contact.",
        },
        {
          id: "pose",
          label: "Pose",
          description: "Strike an exaggerated sculptural pose.",
        },
      ],
    },
    {
      id: "flowers",
      kind: "flowers",
      position: { x: -1.8, z: 2.35 },
      interactionRadius: 1.1,
      tags: ["quiet", "peripheral", "gentle", "living"],
      capabilities: [
        {
          id: "bloom",
          label: "Bloom",
          description: "Open toward the arriving vehicle.",
        },
        {
          id: "fold",
          label: "Fold",
          description: "Close inward and make themselves small.",
        },
        {
          id: "ripple",
          label: "Ripple",
          description: "Pass a wave of motion through the flower bed.",
        },
      ],
    },
    {
      id: "creature",
      kind: "creature",
      position: { x: 3.45, z: 2.15 },
      interactionRadius: 1.0,
      tags: ["small", "curious", "social", "unpredictable"],
      capabilities: [
        {
          id: "hop",
          label: "Hop",
          description: "Hop in place as an excited response.",
        },
        {
          id: "hide",
          label: "Hide",
          description: "Duck away from attention for a moment.",
        },
        {
          id: "circle",
          label: "Circle",
          description:
            "Circle around its home position while watching the vehicle.",
        },
      ],
    },
  ],
  beats: [
    {
      id: "arrival",
      intent:
        "The plaza notices the visitor. Allow a small relationship to form without prescribing which actor or how.",
      availableActions: ["approach", "observe", "orbit", "linger"],
      completion: {
        minInteractions: 2,
      },
      nextBeatId: "discovery",
    },
    {
      id: "discovery",
      intent:
        "Deepen the relationship. Reveal a new side of this place, or revisit a performer with a changed understanding. Earn one memorable moment, without demanding spectacle.",
      availableActions: ["approach", "observe", "orbit", "linger"],
      completion: { minInteractions: 2 },
      nextBeatId: "farewell",
    },
    {
      id: "farewell",
      intent:
        "One final exchange before leaving. Acknowledge the shared history and give the guest a feeling worth carrying away.",
      availableActions: ["observe", "linger", "approach"],
      completion: { minInteractions: 1 },
      nextBeatId: "departure",
    },
    {
      id: "departure",
      intent:
        "Resolve the encounter and carry its emotional residue toward the next scene.",
      availableActions: ["exit"],
      completion: {
        minInteractions: 1,
      },
    },
  ],
  firstBeatId: "arrival",
};
