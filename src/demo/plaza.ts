import type { SceneDefinition } from "../engine/model";

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
      id: "fountain",
      kind: "fountain",
      position: { x: 0, z: 0 },
      tags: ["center-stage", "spectacle", "social", "dramatic"],
    },
    {
      id: "statue",
      kind: "statue",
      position: { x: 2.7, z: -2.1 },
      tags: ["odd", "interactive", "surprising"],
    },
    {
      id: "flowers",
      kind: "flowers",
      position: { x: -1.8, z: 2.35 },
      tags: ["quiet", "peripheral", "gentle", "low-attention"],
    },
    {
      id: "creature",
      kind: "creature",
      position: { x: 3.45, z: 2.15 },
      tags: ["odd", "interactive", "gentle", "surprising"],
    },
  ],
  beats: [
    {
      id: "arrival",
      intent:
        "Offer several dramatically different ways for the vehicle to enter into relationship with the plaza.",
      nextBeatId: "departure",
      affordances: [
        {
          id: "fountain-center",
          label: "Take center stage at the fountain",
          action: "approach",
          actorId: "fountain",
          target: { x: -0.65, z: 0.2 },
          tags: ["center-stage", "spectacle", "social", "dramatic"],
        },
        {
          id: "statue-investigation",
          label: "Investigate the peculiar statue",
          action: "observe",
          actorId: "statue",
          target: { x: 1.95, z: -1.65 },
          tags: ["odd", "interactive", "surprising"],
        },
        {
          id: "garden-edge",
          label: "Slip quietly toward the flowers",
          action: "linger",
          actorId: "flowers",
          target: { x: -2.45, z: 1.8 },
          tags: ["quiet", "peripheral", "gentle", "low-attention"],
        },
        {
          id: "creature-hello",
          label: "Approach the small creature",
          action: "approach",
          actorId: "creature",
          target: { x: 2.75, z: 1.7 },
          tags: ["odd", "interactive", "gentle", "surprising"],
        },
      ],
    },
    {
      id: "departure",
      intent:
        "Resolve the encounter cleanly and carry the guest onward without losing the scene's emotional residue.",
      affordances: [
        {
          id: "plaza-exit",
          label: "Continue to the next scene",
          action: "exit",
          target: { x: 7.2, z: 0 },
          tags: ["transition"],
        },
      ],
    },
  ],
  firstBeatId: "arrival",
};
